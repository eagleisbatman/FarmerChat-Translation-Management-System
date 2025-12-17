/**
 * Integration dispatcher - sends events to configured integrations (Slack, Teams, Discord)
 */

import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { WebhookEvent } from "@/lib/webhooks/events";
import { formatSlackMessage, sendSlackWebhook, sendSlackMessage } from "./slack";
import crypto from "crypto";

/**
 * Decrypt an encrypted value (simple implementation - use proper encryption in production)
 */
function decrypt(encrypted: string, key: string): string {
  // In production, use proper AES-256-GCM decryption
  // This is a placeholder
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.alloc(16));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    // Fallback: assume it's not encrypted (for development)
    return encrypted;
  }
}

/**
 * Dispatch event to all enabled integrations for an organization
 */
export async function dispatchIntegrationEvent(
  organizationId: string,
  event: WebhookEvent
): Promise<void> {
  // Get all enabled integrations for this organization
  const orgIntegrations = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.organizationId, organizationId),
        eq(integrations.enabled, true)
      )
    );

  // Filter integrations that subscribe to this event type
  const subscribedIntegrations = orgIntegrations.filter((integration) => {
    try {
      const events = JSON.parse(integration.events) as string[];
      return events.includes(event.type) || events.includes("*");
    } catch {
      return false;
    }
  });

  // Dispatch to each integration (fire and forget)
  const deliveries = subscribedIntegrations.map(async (integration) => {
    try {
      switch (integration.type) {
        case "slack":
          await dispatchSlackEvent(integration, event);
          break;
        case "teams":
          await dispatchTeamsEvent(integration, event);
          break;
        case "discord":
          await dispatchDiscordEvent(integration, event);
          break;
      }
    } catch (error) {
      console.error(`Error dispatching to ${integration.type} integration ${integration.id}:`, error);
      // Don't throw - continue with other integrations
    }
  });

  // Don't await - fire and forget
  Promise.allSettled(deliveries).catch((error) => {
    console.error("Error dispatching integration events:", error);
  });
}

/**
 * Dispatch event to Slack integration
 */
async function dispatchSlackEvent(
  integration: typeof integrations.$inferSelect,
  event: WebhookEvent
): Promise<void> {
  const message = formatSlackMessage(event);

  // Try webhook URL first (simpler, no OAuth needed)
  if (integration.slackWebhookUrl) {
    await sendSlackWebhook(integration.slackWebhookUrl, {
      ...message,
      channel: integration.slackChannelName,
    });
    return;
  }

  // Otherwise use Bot API (requires OAuth token)
  if (integration.slackBotToken) {
    const encryptionKey = process.env.ENCRYPTION_KEY || "development-key";
    const botToken = decrypt(integration.slackBotToken, encryptionKey);
    const channel = integration.slackChannelId || integration.slackChannelName || "#general";

    await sendSlackMessage(botToken, channel, message);
    return;
  }

  throw new Error("Slack integration not properly configured");
}

/**
 * Dispatch event to Microsoft Teams integration
 */
async function dispatchTeamsEvent(
  integration: typeof integrations.$inferSelect,
  event: WebhookEvent
): Promise<void> {
  if (!integration.teamsWebhookUrl) {
    throw new Error("Teams webhook URL not configured");
  }

  // Format as Teams Adaptive Card
  const adaptiveCard = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "TextBlock",
              text: `LinguaFlow: ${event.type}`,
              weight: "Bolder",
              size: "Large",
            },
            {
              type: "TextBlock",
              text: JSON.stringify(event.data, null, 2),
              wrap: true,
            },
          ],
        },
      },
    ],
  };

  const response = await fetch(integration.teamsWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(adaptiveCard),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook failed: ${response.status}`);
  }
}

/**
 * Dispatch event to Discord integration
 */
async function dispatchDiscordEvent(
  integration: typeof integrations.$inferSelect,
  event: WebhookEvent
): Promise<void> {
  if (!integration.discordWebhookUrl) {
    throw new Error("Discord webhook URL not configured");
  }

  // Format as Discord embed
  const embed = {
    title: `LinguaFlow: ${event.type}`,
    description: JSON.stringify(event.data, null, 2),
    color: 0x3b82f6, // Blue color
    timestamp: event.timestamp,
  };

  const response = await fetch(integration.discordWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      embeds: [embed],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status}`);
  }
}

