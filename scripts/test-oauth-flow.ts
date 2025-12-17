#!/usr/bin/env tsx
/**
 * Test OAuth Flow Endpoint
 * Creates a test endpoint to verify OAuth is working
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  
  const checks = {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    clientIdFormat: clientId?.includes(".apps.googleusercontent.com") || false,
    redirectUri: `${nextAuthUrl}/api/auth/callback/google`,
    signInUrl: `${nextAuthUrl}/signin`,
  };
  
  const allValid = checks.hasClientId && checks.hasClientSecret && checks.clientIdFormat;
  
  return NextResponse.json({
    status: allValid ? "ready" : "not_configured",
    checks,
    message: allValid 
      ? "OAuth is configured correctly. You can test the sign-in flow."
      : "OAuth configuration is incomplete. Please check your environment variables.",
    nextSteps: allValid ? [
      `1. Visit ${checks.signInUrl} to test OAuth flow`,
      `2. Verify redirect URI in Google Cloud Console: ${checks.redirectUri}`,
      "3. After successful login, you can run TestSprite tests"
    ] : [
      "1. Set GOOGLE_CLIENT_ID in .env file",
      "2. Set GOOGLE_CLIENT_SECRET in .env file",
      "3. Set NEXTAUTH_SECRET in .env file",
      "4. Set NEXTAUTH_URL in .env file (default: http://localhost:3000)",
      "5. Configure redirect URI in Google Cloud Console"
    ]
  });
}

