import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { formatErrorResponse, AuthenticationError } from "@/lib/errors";

/**
 * Initiate CLI login flow
 * This endpoint returns a login URL that the CLI will open in the browser
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      // Return login URL
      const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
      const loginUrl = `${baseUrl}/api/cli/callback?redirect=${encodeURIComponent("/api/cli/auth")}`;
      
      return NextResponse.json({
        loginUrl,
        message: "Please visit this URL in your browser to authenticate",
      });
    }

    // User is already authenticated, generate token directly
    const tokenResponse = await fetch(`${request.nextUrl.origin}/api/cli/auth`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("Cookie") || "",
      },
    });

    if (!tokenResponse.ok) {
      throw new AuthenticationError("Failed to generate CLI token");
    }

    const tokenData = await tokenResponse.json();

    return NextResponse.json({
      success: true,
      ...tokenData,
    });
  } catch (error) {
    console.error("Error initiating CLI login:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

