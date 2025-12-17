import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS || "digitalgreen.org,digitalgreentrust.org";
  
  const checks = {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasNextAuthSecret: !!nextAuthSecret,
    hasNextAuthUrl: !!nextAuthUrl,
    clientIdFormat: clientId?.includes(".apps.googleusercontent.com") || false,
    clientSecretLength: clientSecret ? clientSecret.length >= 20 : false,
    nextAuthSecretLength: nextAuthSecret ? nextAuthSecret.length >= 32 : false,
    redirectUri: `${nextAuthUrl}/api/auth/callback/google`,
    signInUrl: `${nextAuthUrl}/signin`,
    allowedDomains: allowedDomains.split(",").map(d => d.trim()),
  };
  
  const allValid = 
    checks.hasClientId && 
    checks.hasClientSecret && 
    checks.hasNextAuthSecret &&
    checks.clientIdFormat &&
    checks.clientSecretLength &&
    checks.nextAuthSecretLength;
  
  return NextResponse.json({
    status: allValid ? "ready" : "not_configured",
    timestamp: new Date().toISOString(),
    checks,
    message: allValid 
      ? "OAuth is configured correctly. You can test the sign-in flow."
      : "OAuth configuration is incomplete. Please check your environment variables.",
    nextSteps: allValid ? [
      `✅ Visit ${checks.signInUrl} to test OAuth flow`,
      `✅ Verify redirect URI in Google Cloud Console: ${checks.redirectUri}`,
      "✅ After successful login, you can run TestSprite tests"
    ] : [
      checks.hasClientId ? "✅ GOOGLE_CLIENT_ID is set" : "❌ Set GOOGLE_CLIENT_ID in .env file",
      checks.hasClientSecret ? "✅ GOOGLE_CLIENT_SECRET is set" : "❌ Set GOOGLE_CLIENT_SECRET in .env file",
      checks.hasNextAuthSecret ? "✅ NEXTAUTH_SECRET is set" : "❌ Set NEXTAUTH_SECRET in .env file",
      checks.hasNextAuthUrl ? "✅ NEXTAUTH_URL is set" : "⚠️  NEXTAUTH_URL not set (using default)",
      checks.clientIdFormat ? "✅ Client ID format is valid" : "❌ Client ID format is invalid",
      checks.clientSecretLength ? "✅ Client Secret length is valid" : "❌ Client Secret appears too short",
      checks.nextAuthSecretLength ? "✅ NextAuth Secret length is valid" : "⚠️  NextAuth Secret should be at least 32 characters",
      "📖 See docs/OAUTH_SETUP.md for detailed setup instructions"
    ]
  });
}

