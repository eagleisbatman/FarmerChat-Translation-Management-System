/**
 * Webhook dispatcher - handles webhook delivery with retry logic
 */

import { db } from "@/lib/db";
import { webhooks, webhookDeliveries, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";
import type { WebhookEvent } from "./events";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

/**
 * Sign webhook payload with HMAC SHA256
 */
function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Deliver webhook with retry logic
 */
async function deliverWebhook(
  webhook: typeof webhooks.$inferSelect,
  event: WebhookEvent,
  attemptNumber: number = 1
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const payload = JSON.stringify(event);
  const signature = signPayload(payload, webhook.secret);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-LinguaFlow-Signature": `sha256=${signature}`,
        "X-LinguaFlow-Event": event.type,
        "X-LinguaFlow-Delivery": event.id,
      },
      body: payload,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const responseBody = await response.text().catch(() => "");

    // Log delivery
    await db.insert(webhookDeliveries).values({
      id: nanoid(),
      webhookId: webhook.id,
      eventType: event.type as any,
      payload,
      status: response.ok ? "success" : "failed",
      statusCode: response.status,
      responseBody: responseBody.substring(0, 1000), // Limit response body size
      attemptNumber,
      createdAt: new Date(),
      deliveredAt: response.ok ? new Date() : undefined,
    });

    if (response.ok) {
      // Update webhook last triggered time and reset failure count
      await db
        .update(webhooks)
        .set({
          lastTriggeredAt: new Date(),
          failureCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(webhooks.id, webhook.id));

      return { success: true, statusCode: response.status };
    } else {
      return {
        success: false,
        statusCode: response.status,
        error: `HTTP ${response.status}: ${responseBody.substring(0, 200)}`,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log failed delivery
    await db.insert(webhookDeliveries).values({
      id: nanoid(),
      webhookId: webhook.id,
      eventType: event.type as any,
      payload,
      status: "failed",
      errorMessage: errorMessage.substring(0, 500),
      attemptNumber,
      createdAt: new Date(),
    });

    // Increment failure count
    await db
      .update(webhooks)
      .set({
        failureCount: (webhook.failureCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(webhooks.id, webhook.id));

    return { success: false, error: errorMessage };
  }
}

/**
 * Dispatch webhook event to all active webhooks for a project
 * Also dispatches to communication integrations (Slack, Teams, Discord)
 */
export async function dispatchWebhookEvent(
  projectId: string,
  event: WebhookEvent
): Promise<void> {
  // Get project to find organization ID
  const { projects } = await import("@/lib/db/schema");
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  // Dispatch to communication integrations if project has organization
  if (project?.organizationId) {
    const { dispatchIntegrationEvent } = await import("@/lib/integrations/dispatcher");
    dispatchIntegrationEvent(project.organizationId, event).catch((error) => {
      console.error("Error dispatching integration event:", error);
    });
  }
  // Get all active webhooks for this project that subscribe to this event type
  const activeWebhooks = await db
    .select()
    .from(webhooks)
    .where(
      and(
        eq(webhooks.projectId, projectId),
        eq(webhooks.status, "active")
      )
    );

  // Filter webhooks that subscribe to this event type
  const subscribedWebhooks = activeWebhooks.filter((webhook) => {
    try {
      const events = JSON.parse(webhook.events) as string[];
      return events.includes(event.type) || events.includes("*");
    } catch {
      return false;
    }
  });

  // Dispatch to all subscribed webhooks (fire and forget)
  const deliveries = subscribedWebhooks.map(async (webhook) => {
    let attemptNumber = 1;
    let lastError: string | undefined;

    while (attemptNumber <= MAX_RETRIES) {
      const result = await deliverWebhook(webhook, event, attemptNumber);

      if (result.success) {
        return; // Success, stop retrying
      }

      lastError = result.error;
      attemptNumber++;

      // Wait before retry (exponential backoff)
      if (attemptNumber <= MAX_RETRIES) {
        const delay = RETRY_DELAYS[attemptNumber - 2] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // If all retries failed, disable webhook if failure count exceeds threshold
    if ((webhook.failureCount || 0) + 1 >= 10) {
      await db
        .update(webhooks)
        .set({
          status: "disabled",
          updatedAt: new Date(),
        })
        .where(eq(webhooks.id, webhook.id));
    }
  });

  // Don't await - fire and forget
  Promise.allSettled(deliveries).catch((error) => {
    console.error("Error dispatching webhooks:", error);
  });
}

/**
 * Retry failed webhook deliveries (can be called by a cron job)
 */
export async function retryFailedWebhookDeliveries(): Promise<void> {
  const failedDeliveries = await db
    .select({
      delivery: webhookDeliveries,
      webhook: webhooks,
    })
    .from(webhookDeliveries)
    .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
    .where(
      and(
        eq(webhookDeliveries.status, "failed"),
        eq(webhooks.status, "active")
      )
    )
    .limit(100); // Process max 100 at a time

  for (const { delivery, webhook } of failedDeliveries) {
    if (delivery.attemptNumber && delivery.attemptNumber < MAX_RETRIES) {
      try {
        const event = JSON.parse(delivery.payload) as WebhookEvent;
        await deliverWebhook(webhook, event, (delivery.attemptNumber || 0) + 1);
      } catch (error) {
        console.error(`Error retrying webhook delivery ${delivery.id}:`, error);
      }
    }
  }
}

