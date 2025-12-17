#!/usr/bin/env tsx
/**
 * OAuth Configuration Validator
 * Validates Google OAuth setup before running tests
 */

import dotenv from "dotenv";
import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config: {
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasNextAuthSecret: boolean;
    hasNextAuthUrl: boolean;
    clientIdFormat: "valid" | "invalid" | "missing";
    redirectUri: string | null;
  };
}

function validateOAuthConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  const nextAuthUrl = process.env.NEXTAUTH_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  
  const hasClientId = !!clientId;
  const hasClientSecret = !!clientSecret;
  const hasNextAuthSecret = !!nextAuthSecret;
  const hasNextAuthUrl = !!nextAuthUrl;
  
  // Validate Client ID format
  let clientIdFormat: "valid" | "invalid" | "missing" = "missing";
  if (hasClientId) {
    if (clientId!.includes(".apps.googleusercontent.com") || clientId!.length > 20) {
      clientIdFormat = "valid";
    } else {
      clientIdFormat = "invalid";
      errors.push("GOOGLE_CLIENT_ID format appears invalid (should end with .apps.googleusercontent.com)");
    }
  } else {
    errors.push("GOOGLE_CLIENT_ID is missing");
  }
  
  // Validate Client Secret format
  if (hasClientSecret) {
    if (clientSecret!.length < 20) {
      errors.push("GOOGLE_CLIENT_SECRET appears too short (should be at least 20 characters)");
    }
  } else {
    errors.push("GOOGLE_CLIENT_SECRET is missing");
  }
  
  // Validate NextAuth Secret
  if (!hasNextAuthSecret) {
    errors.push("NEXTAUTH_SECRET is missing (required for session encryption)");
  } else if (nextAuthSecret!.length < 32) {
    warnings.push("NEXTAUTH_SECRET should be at least 32 characters for security");
  }
  
  // Validate NextAuth URL
  if (!hasNextAuthUrl) {
    warnings.push("NEXTAUTH_URL not set, using default: http://localhost:3000");
  }
  
  // Construct redirect URI
  const redirectUri = hasNextAuthUrl 
    ? `${nextAuthUrl}/api/auth/callback/google`
    : "http://localhost:3000/api/auth/callback/google";
  
  // Check allowed email domains
  const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS || "digitalgreen.org,digitalgreentrust.org";
  if (!allowedDomains.includes("digitalgreen.org") && !allowedDomains.includes("digitalgreentrust.org")) {
    warnings.push("ALLOWED_EMAIL_DOMAINS doesn't include expected domains");
  }
  
  const isValid = errors.length === 0;
  
  return {
    isValid,
    errors,
    warnings,
    config: {
      hasClientId,
      hasClientSecret,
      hasNextAuthSecret,
      hasNextAuthUrl,
      clientIdFormat,
      redirectUri,
    },
  };
}

function printValidationReport(result: ValidationResult) {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 Google OAuth Configuration Validation");
  console.log("=".repeat(60) + "\n");
  
  console.log("Configuration Status:");
  console.log(`  ✓ Client ID: ${result.config.hasClientId ? "✅ Set" : "❌ Missing"}`);
  console.log(`  ✓ Client Secret: ${result.config.hasClientSecret ? "✅ Set" : "❌ Missing"}`);
  console.log(`  ✓ NextAuth Secret: ${result.config.hasNextAuthSecret ? "✅ Set" : "❌ Missing"}`);
  console.log(`  ✓ NextAuth URL: ${result.config.hasNextAuthUrl ? "✅ Set" : "⚠️  Using default"}`);
  console.log(`  ✓ Client ID Format: ${result.config.clientIdFormat === "valid" ? "✅ Valid" : result.config.clientIdFormat === "invalid" ? "❌ Invalid" : "❌ Missing"}`);
  console.log(`  ✓ Redirect URI: ${result.config.redirectUri}\n`);
  
  if (result.errors.length > 0) {
    console.log("❌ ERRORS (Must Fix):");
    result.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
    console.log();
  }
  
  if (result.warnings.length > 0) {
    console.log("⚠️  WARNINGS:");
    result.warnings.forEach((warning, index) => {
      console.log(`  ${index + 1}. ${warning}`);
    });
    console.log();
  }
  
  if (result.isValid) {
    console.log("✅ OAuth configuration is valid!\n");
    console.log("Next Steps:");
    console.log("  1. Verify redirect URI in Google Cloud Console:");
    console.log(`     ${result.config.redirectUri}`);
    console.log("  2. Test OAuth flow manually:");
    console.log(`     ${result.config.redirectUri?.replace("/api/auth/callback/google", "/signin")}`);
    console.log("  3. Run tests after confirming OAuth works\n");
  } else {
    console.log("❌ OAuth configuration has errors. Please fix them before running tests.\n");
    console.log("Setup Instructions:");
    console.log("  1. Go to https://console.cloud.google.com/apis/credentials");
    console.log("  2. Create OAuth 2.0 Client ID credentials");
    console.log("  3. Add authorized redirect URI:");
    console.log(`     ${result.config.redirectUri}`);
    console.log("  4. Copy Client ID and Client Secret to .env file");
    console.log("  5. Generate NEXTAUTH_SECRET: openssl rand -base64 32");
    console.log("  6. Set NEXTAUTH_URL: http://localhost:3000 (for local dev)\n");
  }
  
  console.log("=".repeat(60) + "\n");
  
  return result.isValid;
}

// Run validation
const result = validateOAuthConfig();
const isValid = printValidationReport(result);

// Exit with error code if invalid
process.exit(isValid ? 0 : 1);

