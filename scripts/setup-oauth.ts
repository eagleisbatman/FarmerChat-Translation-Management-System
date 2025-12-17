#!/usr/bin/env tsx
/**
 * OAuth Setup Helper Script
 * Helps configure Google OAuth credentials
 */

import * as fs from "fs";
import * as path from "path";

const ENV_FILE = path.join(process.cwd(), ".env");
const ENV_EXAMPLE = `
# Google OAuth Credentials
# Get these from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=1041029163083-3hesm7h690j29mkrs9jfjtao3anti57m.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE

# NextAuth Configuration
# Generated secret (keep this secure!)
NEXTAUTH_SECRET=T2kCIyddtdqmapr7nYCCWlM5JyZlu7NnhAqKt+SK54w=
NEXTAUTH_URL=http://localhost:3000

# Allowed Email Domains
ALLOWED_EMAIL_DOMAINS=digitalgreen.org,digitalgreentrust.org
`.trim();

function main() {
  console.log("🔐 OAuth Setup Helper\n");
  console.log("=".repeat(60));
  
  // Check if .env exists
  if (fs.existsSync(ENV_FILE)) {
    console.log("\n✓ Found existing .env file");
    
    // Read current .env
    const currentEnv = fs.readFileSync(ENV_FILE, "utf-8");
    
    // Check what's already configured
    const hasClientId = currentEnv.includes("GOOGLE_CLIENT_ID");
    const hasClientSecret = currentEnv.includes("GOOGLE_CLIENT_SECRET") && 
                           !currentEnv.includes("YOUR_CLIENT_SECRET_HERE");
    const hasNextAuthSecret = currentEnv.includes("NEXTAUTH_SECRET");
    const hasNextAuthUrl = currentEnv.includes("NEXTAUTH_URL");
    
    console.log("\nCurrent Configuration:");
    console.log(`  ${hasClientId ? "✓" : "✗"} GOOGLE_CLIENT_ID: ${hasClientId ? "Set" : "Missing"}`);
    console.log(`  ${hasClientSecret ? "✓" : "✗"} GOOGLE_CLIENT_SECRET: ${hasClientSecret ? "Set" : "Missing"}`);
    console.log(`  ${hasNextAuthSecret ? "✓" : "✗"} NEXTAUTH_SECRET: ${hasNextAuthSecret ? "Set" : "Missing"}`);
    console.log(`  ${hasNextAuthUrl ? "✓" : "✗"} NEXTAUTH_URL: ${hasNextAuthUrl ? "Set" : "Missing"}`);
    
    if (hasClientId && hasClientSecret && hasNextAuthSecret && hasNextAuthUrl) {
      console.log("\n✅ All OAuth variables are configured!");
      console.log("\nNext steps:");
      console.log("1. Make sure redirect URI is configured in Google Cloud Console:");
      console.log("   http://localhost:3000/api/auth/callback/google");
      console.log("2. Run: npm run validate:oauth");
      console.log("3. Start dev server: npm run dev");
      return;
    }
    
    // Update .env with new values
    let updatedEnv = currentEnv;
    
    // Update GOOGLE_CLIENT_ID (replace placeholder or existing value)
    if (currentEnv.includes("GOOGLE_CLIENT_ID=")) {
      updatedEnv = updatedEnv.replace(
        /GOOGLE_CLIENT_ID=.*/g,
        "GOOGLE_CLIENT_ID=1041029163083-3hesm7h690j29mkrs9jfjtao3anti57m.apps.googleusercontent.com"
      );
    } else {
      updatedEnv += "\nGOOGLE_CLIENT_ID=1041029163083-3hesm7h690j29mkrs9jfjtao3anti57m.apps.googleusercontent.com";
    }
    
    // Update NEXTAUTH_SECRET (replace placeholder or existing value)
    const generatedSecret = "T2kCIyddtdqmapr7nYCCWlM5JyZlu7NnhAqKt+SK54w=";
    if (currentEnv.includes("NEXTAUTH_SECRET=")) {
      // Only replace if it's a placeholder
      if (currentEnv.includes("your-nextauth-secret-here") || currentEnv.includes("YOUR_NEXTAUTH_SECRET")) {
        updatedEnv = updatedEnv.replace(
          /NEXTAUTH_SECRET=.*/g,
          `NEXTAUTH_SECRET=${generatedSecret}`
        );
      }
    } else {
      updatedEnv += `\nNEXTAUTH_SECRET=${generatedSecret}`;
    }
    
    // Update NEXTAUTH_URL (ensure it's set correctly)
    if (currentEnv.includes("NEXTAUTH_URL=")) {
      // Only update if it's a placeholder
      if (currentEnv.includes("your-nextauth-url") || !currentEnv.includes("localhost:3000")) {
        updatedEnv = updatedEnv.replace(
          /NEXTAUTH_URL=.*/g,
          "NEXTAUTH_URL=http://localhost:3000"
        );
      }
    } else {
      updatedEnv += "\nNEXTAUTH_URL=http://localhost:3000";
    }
    
    fs.writeFileSync(ENV_FILE, updatedEnv);
    console.log("\n✓ Updated .env file with new values");
    
  } else {
    // Create new .env file
    console.log("\n✗ No .env file found. Creating one...");
    fs.writeFileSync(ENV_FILE, ENV_EXAMPLE);
    console.log("✓ Created .env file with template");
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("\n⚠️  IMPORTANT: You still need to:");
  console.log("\n1. Get your Google Client Secret:");
  console.log("   → Go to: https://console.cloud.google.com/apis/credentials");
  console.log("   → Find your OAuth 2.0 Client ID");
  console.log("   → Click on it to view details");
  console.log("   → Copy the 'Client secret' value");
  console.log("   → Update GOOGLE_CLIENT_SECRET in .env file");
  
  console.log("\n2. Configure Redirect URI in Google Cloud Console:");
  console.log("   → Go to: https://console.cloud.google.com/apis/credentials");
  console.log("   → Click on your OAuth 2.0 Client ID");
  console.log("   → Under 'Authorized redirect URIs', click '+ ADD URI'");
  console.log("   → Add exactly: http://localhost:3000/api/auth/callback/google");
  console.log("   → Click 'SAVE'");
  
  console.log("\n3. Add Test Users (if app is in Testing mode):");
  console.log("   → Go to: APIs & Services → OAuth consent screen");
  console.log("   → Scroll to 'Test users' section");
  console.log("   → Add emails from digitalgreen.org or digitalgreentrust.org");
  
  console.log("\n4. After updating GOOGLE_CLIENT_SECRET, run:");
  console.log("   npm run validate:oauth");
  
  console.log("\n" + "=".repeat(60));
}

main();

