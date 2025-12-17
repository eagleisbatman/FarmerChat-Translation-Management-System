import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formatErrorResponse, AuthenticationError, ForbiddenError } from "@/lib/errors";
import { verifyOrganizationAccess } from "@/lib/security/organization-access";
import { getOrganizationSettings, updateOrganizationSettings } from "@/lib/organizations/settings";
import { z } from "zod";

const updateSettingsSchema = z.object({
  email: z.object({
    provider: z.enum(["smtp", "resend", "sendgrid", "ses"]).optional(),
    from: z.string().email().optional(),
    fromName: z.string().optional(),
    smtp: z.object({
      host: z.string(),
      port: z.number(),
      user: z.string(),
      password: z.string(),
      secure: z.boolean().optional(),
    }).optional(),
    resendApiKey: z.string().optional(),
    sendgridApiKey: z.string().optional(),
    ses: z.object({
      accessKeyId: z.string(),
      secretAccessKey: z.string(),
      region: z.string(),
    }).optional(),
  }).optional(),
  ai: z.object({
    openaiApiKey: z.string().optional(),
    geminiApiKey: z.string().optional(),
    googleTranslateApiKey: z.string().optional(),
  }).optional(),
  auth: z.object({
    allowedEmailDomains: z.array(z.string()).optional(),
    googleClientId: z.string().optional(),
    googleClientSecret: z.string().optional(),
  }).optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  aiTranslationEnabled: z.boolean().optional(),
}).partial();

/**
 * GET /api/organizations/[id]/settings
 * Get organization settings (admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), {
        status: 401,
      });
    }

    // Verify admin access
    await verifyOrganizationAccess(session.user.id, id, true);

    const settings = await getOrganizationSettings(id);

    if (!settings) {
      return NextResponse.json({ settings: null });
    }

    // Return settings (sensitive fields already decrypted by service)
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching organization settings:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

/**
 * PATCH /api/organizations/[id]/settings
 * Update organization settings (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), {
        status: 401,
      });
    }

    // Verify admin access
    await verifyOrganizationAccess(session.user.id, id, true);

    const body = await request.json();
    const data = updateSettingsSchema.parse(body);

    const updated = await updateOrganizationSettings(id, data);

    return NextResponse.json({ settings: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        formatErrorResponse(new ValidationError(error.errors[0].message)),
        { status: 400 }
      );
    }
    console.error("Error updating organization settings:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

