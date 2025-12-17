import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError, NotFoundError } from "@/lib/errors";
import { verifyOrganizationAccess } from "@/lib/security/organization-access";

/**
 * DELETE /api/organizations/[id]/integrations/[integrationId]
 * Delete an integration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; integrationId: string }> }
) {
  try {
    const session = await auth();
    const { id: organizationId, integrationId } = await params;

    if (!session) {
      throw new AuthenticationError("Authentication required");
    }

    // Verify user has admin access to organization
    await verifyOrganizationAccess(session.user.id, organizationId, true);

    // Verify integration exists and belongs to organization
    const [existingIntegration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.id, integrationId),
          eq(integrations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!existingIntegration) {
      throw new NotFoundError("Integration");
    }

    await db.delete(integrations).where(eq(integrations.id, integrationId));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting integration:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

