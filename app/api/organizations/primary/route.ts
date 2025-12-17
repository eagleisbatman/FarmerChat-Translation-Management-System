import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formatErrorResponse, AuthenticationError } from "@/lib/errors";
import { getUserPrimaryOrganization } from "@/lib/security/organization-access";

/**
 * GET /api/organizations/primary
 * Get user's primary organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), {
        status: 401,
      });
    }

    const primaryOrg = await getUserPrimaryOrganization(session.user.id);

    if (!primaryOrg) {
      return NextResponse.json({ organization: null });
    }

    return NextResponse.json({ organization: primaryOrg });
  } catch (error) {
    console.error("Error fetching primary organization:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

