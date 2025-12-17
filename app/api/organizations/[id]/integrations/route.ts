import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, NotFoundError } from "@/lib/errors";
import { verifyOrganizationAccess } from "@/lib/security/organization-access";
import crypto from "crypto";

const createSlackIntegrationSchema = z.object({
  type: z.literal("slack"),
  name: z.string().min(1),
  slackWebhookUrl: z.string().url().optional(),
  slackChannelId: z.string().optional(),
  slackChannelName: z.string().optional(),
  events: z.array(z.string()).min(1),
  enabled: z.boolean().optional().default(true),
});

const createTeamsIntegrationSchema = z.object({
  type: z.literal("teams"),
  name: z.string().min(1),
  teamsWebhookUrl: z.string().url(),
  events: z.array(z.string()).min(1),
  enabled: z.boolean().optional().default(true),
});

const createDiscordIntegrationSchema = z.object({
  type: z.literal("discord"),
  name: z.string().min(1),
  discordWebhookUrl: z.string().url(),
  events: z.array(z.string()).min(1),
  enabled: z.boolean().optional().default(true),
});

const createIntegrationSchema = z.discriminatedUnion("type", [
  createSlackIntegrationSchema,
  createTeamsIntegrationSchema,
  createDiscordIntegrationSchema,
]);

/**
 * Encrypt a value (simple implementation - use proper encryption in production)
 */
function encrypt(value: string, key: string): string {
  // In production, use proper AES-256-GCM encryption
  // This is a placeholder
  try {
    const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.alloc(16));
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  } catch {
    // Fallback: return as-is (for development)
    return value;
  }
}

/**
 * GET /api/organizations/[id]/integrations
 * List all integrations for an organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: organizationId } = await params;

    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    // Verify user has access to organization
    await verifyOrganizationAccess(session.user.id, organizationId);

    const orgIntegrations = await db
      .select()
      .from(integrations)
      .where(eq(integrations.organizationId, organizationId))
      .orderBy(integrations.createdAt);

    // Don't return sensitive tokens
    const safeIntegrations = orgIntegrations.map((integration) => ({
      id: integration.id,
      type: integration.type,
      name: integration.name,
      slackWorkspaceId: integration.slackWorkspaceId,
      slackChannelId: integration.slackChannelId,
      slackChannelName: integration.slackChannelName,
      slackWebhookUrl: integration.slackWebhookUrl ? "***configured***" : null,
      teamsWebhookUrl: integration.teamsWebhookUrl ? "***configured***" : null,
      discordWebhookUrl: integration.discordWebhookUrl ? "***configured***" : null,
      enabled: integration.enabled,
      events: JSON.parse(integration.events),
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    }));

    return NextResponse.json(safeIntegrations);
  } catch (error) {
    console.error("Error fetching integrations:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

/**
 * POST /api/organizations/[id]/integrations
 * Create a new integration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: organizationId } = await params;

    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    // Verify user has admin access to organization
    await verifyOrganizationAccess(session.user.id, organizationId, true);

    const body = await request.json();
    const data = createIntegrationSchema.parse(body);

    const encryptionKey = process.env.ENCRYPTION_KEY || "development-key";

    const integrationData: Partial<typeof integrations.$inferInsert> = {
      id: nanoid(),
      organizationId,
      type: data.type,
      name: data.name,
      events: JSON.stringify(data.events),
      enabled: data.enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Type-specific fields
    if (data.type === "slack") {
      integrationData.slackWebhookUrl = data.slackWebhookUrl;
      integrationData.slackChannelId = data.slackChannelId;
      integrationData.slackChannelName = data.slackChannelName;
      // Note: slackAccessToken and slackBotToken would be set via OAuth flow
    } else if (data.type === "teams") {
      integrationData.teamsWebhookUrl = data.teamsWebhookUrl;
    } else if (data.type === "discord") {
      integrationData.discordWebhookUrl = data.discordWebhookUrl;
    }

    const [newIntegration] = await db
      .insert(integrations)
      .values(integrationData)
      .returning();

    // Return safe version without sensitive data
    return NextResponse.json(
      {
        id: newIntegration.id,
        type: newIntegration.type,
        name: newIntegration.name,
        enabled: newIntegration.enabled,
        events: JSON.parse(newIntegration.events),
        createdAt: newIntegration.createdAt,
        updatedAt: newIntegration.updatedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse = formatErrorResponse(new ValidationError(error.errors[0].message));
      return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
    }
    console.error("Error creating integration:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}


