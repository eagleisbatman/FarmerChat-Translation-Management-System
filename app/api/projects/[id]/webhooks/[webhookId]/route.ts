import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, NotFoundError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "paused", "disabled"]).optional(),
});

/**
 * PATCH /api/projects/[id]/webhooks/[webhookId]
 * Update a webhook
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const session = await auth();
    const { id: projectId, webhookId } = await params;

    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    // Verify user has admin access to project's organization
    await verifyProjectAccess(session.user.id, projectId, true);

    const body = await request.json();
    const data = updateWebhookSchema.parse(body);

    // Verify webhook exists and belongs to project
    const [existingWebhook] = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.projectId, projectId)))
      .limit(1);

    if (!existingWebhook) {
      throw new NotFoundError("Webhook");
    }

    const updateData: Partial<typeof webhooks.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.url !== undefined) {
      updateData.url = data.url;
    }
    if (data.events !== undefined) {
      updateData.events = JSON.stringify(data.events);
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
      // Reset failure count when reactivating
      if (data.status === "active" && existingWebhook.status !== "active") {
        updateData.failureCount = 0;
      }
    }

    const [updatedWebhook] = await db
      .update(webhooks)
      .set(updateData)
      .where(eq(webhooks.id, webhookId))
      .returning();

    return NextResponse.json({
      id: updatedWebhook.id,
      url: updatedWebhook.url,
      events: JSON.parse(updatedWebhook.events),
      status: updatedWebhook.status,
      description: updatedWebhook.description,
      createdAt: updatedWebhook.createdAt,
      updatedAt: updatedWebhook.updatedAt,
      lastTriggeredAt: updatedWebhook.lastTriggeredAt,
      failureCount: updatedWebhook.failureCount,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse = formatErrorResponse(new ValidationError(error.errors[0].message));
      return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
    }
    console.error("Error updating webhook:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

/**
 * DELETE /api/projects/[id]/webhooks/[webhookId]
 * Delete a webhook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; webhookId: string }> }
) {
  try {
    const session = await auth();
    const { id: projectId, webhookId } = await params;

    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    // Verify user has admin access to project's organization
    await verifyProjectAccess(session.user.id, projectId, true);

    // Verify webhook exists and belongs to project
    const [existingWebhook] = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.projectId, projectId)))
      .limit(1);

    if (!existingWebhook) {
      throw new NotFoundError("Webhook");
    }

    await db.delete(webhooks).where(eq(webhooks.id, webhookId));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting webhook:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

