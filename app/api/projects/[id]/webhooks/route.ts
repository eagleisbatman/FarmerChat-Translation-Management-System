import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhooks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, NotFoundError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";
import crypto from "crypto";

const createWebhookSchema = z.object({
  url: z.string().url("Invalid webhook URL"),
  events: z.array(z.string()).min(1, "At least one event type is required"),
  description: z.string().optional(),
  status: z.enum(["active", "paused", "disabled"]).optional().default("active"),
});


/**
 * GET /api/projects/[id]/webhooks
 * List all webhooks for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: projectId } = await params;

    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, projectId);

    const projectWebhooks = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.projectId, projectId))
      .orderBy(webhooks.createdAt);

    // Don't return secrets in the response
    const safeWebhooks = projectWebhooks.map((webhook) => ({
      id: webhook.id,
      url: webhook.url,
      events: JSON.parse(webhook.events),
      status: webhook.status,
      description: webhook.description,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
      lastTriggeredAt: webhook.lastTriggeredAt,
      failureCount: webhook.failureCount,
    }));

    return NextResponse.json(safeWebhooks);
  } catch (error) {
    console.error("Error fetching webhooks:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

/**
 * POST /api/projects/[id]/webhooks
 * Create a new webhook
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: projectId } = await params;

    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    // Verify user has admin access to project's organization
    await verifyProjectAccess(session.user.id, projectId, true);

    const body = await request.json();
    const data = createWebhookSchema.parse(body);

    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString("hex");

    const [newWebhook] = await db
      .insert(webhooks)
      .values({
        id: nanoid(),
        projectId,
        url: data.url,
        secret,
        events: JSON.stringify(data.events),
        status: data.status,
        description: data.description,
        failureCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Return webhook with secret (only shown once)
    return NextResponse.json(
      {
        id: newWebhook.id,
        url: newWebhook.url,
        events: JSON.parse(newWebhook.events),
        status: newWebhook.status,
        description: newWebhook.description,
        secret, // Include secret in response (user should save this)
        createdAt: newWebhook.createdAt,
        updatedAt: newWebhook.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse = formatErrorResponse(new ValidationError(error.errors[0].message));
      return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
    }
    console.error("Error creating webhook:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}


