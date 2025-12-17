import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { cliTokens } from "@/lib/db/schema";
import { redirect } from "next/navigation";

/**
 * OAuth callback for CLI login
 * After user authenticates, generate token and redirect back to CLI
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  const redirectUrl = request.nextUrl.searchParams.get("redirect");

  if (!session) {
    // Redirect to sign in
    return redirect(`/signin?callbackUrl=${encodeURIComponent(request.url)}`);
  }

  // User is authenticated, generate CLI token
  const token = `cli_${nanoid(48)}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry

  await db.insert(cliTokens).values({
    id: nanoid(),
    userId: session.user.id,
    token,
    expiresAt,
    createdAt: new Date(),
  });

  // Redirect back to CLI with token
  if (redirectUrl) {
    const url = new URL(redirectUrl);
    url.searchParams.set("token", token);
    return redirect(url.toString());
  }

  // Fallback: return token in JSON
  return NextResponse.json({
    success: true,
    token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
  });
}

