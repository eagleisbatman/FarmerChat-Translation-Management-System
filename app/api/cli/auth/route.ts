import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { cliTokens, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError } from "@/lib/errors";

/**
 * Generate a CLI token for the authenticated user
 * This token is used for CLI operations instead of session cookies
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      throw new AuthenticationError();
    }

    // Generate a secure token
    const token = `cli_${nanoid(48)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry

    // Store token in database
    await db.insert(cliTokens).values({
      id: nanoid(),
      userId: session.user.id,
      token,
      expiresAt,
      createdAt: new Date(),
    });

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      },
    });
  } catch (error) {
    console.error("Error generating CLI token:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

/**
 * Verify CLI token and return user info
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      throw new AuthenticationError("CLI token is required");
    }

    // Find token in database
    const [cliToken] = await db
      .select()
      .from(cliTokens)
      .where(eq(cliTokens.token, token))
      .limit(1);

    if (!cliToken) {
      throw new AuthenticationError("Invalid CLI token");
    }

    // Check if token is expired
    if (new Date(cliToken.expiresAt) < new Date()) {
      throw new AuthenticationError("CLI token has expired");
    }

    // Get user info
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, cliToken.userId))
      .limit(1);

    if (!user) {
      throw new AuthenticationError("User not found");
    }

    return NextResponse.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error verifying CLI token:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

