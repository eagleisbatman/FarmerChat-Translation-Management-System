/**
 * Migration script to convert existing single-tenant data to multi-tenant architecture
 * 
 * This script:
 * 1. Creates a default organization
 * 2. Assigns all existing users to the default organization
 * 3. Migrates all existing projects to the default organization
 * 4. Creates organization settings from environment variables
 * 
 * Run with: npx tsx scripts/migrate-to-multi-tenant.ts
 */

import { db } from "../lib/db";
import { 
  organizations, 
  organizationMembers, 
  organizationSettings, 
  users, 
  projects 
} from "../lib/db/schema";
import { eq, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { encrypt } from "../lib/security/encryption";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function migrateToMultiTenant() {
  console.log("🔄 Starting multi-tenant migration...\n");

  try {
    // Step 1: Check if organizations already exist
    const existingOrgs = await db.select().from(organizations).limit(1);
    
    if (existingOrgs.length > 0) {
      console.log("⚠️  Organizations already exist. Skipping migration.");
      console.log("   If you want to re-run, delete all organizations first.");
      return;
    }

    // Step 2: Create default organization
    const defaultOrgName = process.env.DEFAULT_ORG_NAME || "Default Organization";
    const defaultOrgSlug = process.env.DEFAULT_ORG_SLUG || "default";
    
    console.log(`📦 Creating default organization: "${defaultOrgName}"`);
    
    const orgId = nanoid();
    const [defaultOrg] = await db
      .insert(organizations)
      .values({
        id: orgId,
        name: defaultOrgName,
        slug: defaultOrgSlug,
        domain: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log(`✅ Created organization: ${defaultOrg.id}\n`);

    // Step 3: Assign all existing users to default organization
    console.log("👥 Assigning users to default organization...");
    
    const allUsers = await db.select().from(users);
    console.log(`   Found ${allUsers.length} users`);
    
    if (allUsers.length > 0) {
      const memberInserts = allUsers.map((user, index) => ({
        id: nanoid(),
        organizationId: orgId,
        userId: user.id,
        role: index === 0 ? "owner" as const : "member" as const, // First user becomes owner
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      await db.insert(organizationMembers).values(memberInserts);
      console.log(`✅ Assigned ${allUsers.length} users to organization\n`);
    }

    // Step 4: Migrate existing projects to default organization
    console.log("📁 Migrating projects to default organization...");
    
    // Get projects without organizationId (shouldn't exist if schema is correct, but check anyway)
    const allProjects = await db.select().from(projects);
    console.log(`   Found ${allProjects.length} projects`);
    
    if (allProjects.length > 0) {
      // Update projects to belong to default organization
      for (const project of allProjects) {
        // Only update if organizationId is null (shouldn't happen with NOT NULL constraint, but safe check)
        if (!project.organizationId) {
          await db
            .update(projects)
            .set({ organizationId: orgId })
            .where(eq(projects.id, project.id));
        }
      }
      console.log(`✅ Migrated ${allProjects.length} projects to organization\n`);
    }

    // Step 5: Create organization settings from environment variables
    console.log("⚙️  Creating organization settings from environment variables...");
    
    const settingsId = nanoid();
    
    // Encrypt API keys if ENCRYPTION_KEY is set
    let openaiApiKey: string | undefined;
    let geminiApiKey: string | undefined;
    let googleTranslateApiKey: string | undefined;
    let resendApiKey: string | undefined;
    let sendgridApiKey: string | undefined;
    let sesAccessKeyId: string | undefined;
    let sesSecretAccessKey: string | undefined;
    let smtpPassword: string | undefined;
    let googleClientId: string | undefined;
    let googleClientSecret: string | undefined;

    try {
      if (process.env.OPENAI_API_KEY) {
        openaiApiKey = encrypt(process.env.OPENAI_API_KEY);
      }
      if (process.env.GEMINI_API_KEY) {
        geminiApiKey = encrypt(process.env.GEMINI_API_KEY);
      }
      if (process.env.GOOGLE_TRANSLATE_API_KEY) {
        googleTranslateApiKey = encrypt(process.env.GOOGLE_TRANSLATE_API_KEY);
      }
      if (process.env.RESEND_API_KEY) {
        resendApiKey = encrypt(process.env.RESEND_API_KEY);
      }
      if (process.env.SENDGRID_API_KEY) {
        sendgridApiKey = encrypt(process.env.SENDGRID_API_KEY);
      }
      if (process.env.AWS_ACCESS_KEY_ID) {
        sesAccessKeyId = encrypt(process.env.AWS_ACCESS_KEY_ID);
      }
      if (process.env.AWS_SECRET_ACCESS_KEY) {
        sesSecretAccessKey = encrypt(process.env.AWS_SECRET_ACCESS_KEY);
      }
      if (process.env.SMTP_PASSWORD) {
        smtpPassword = encrypt(process.env.SMTP_PASSWORD);
      }
      if (process.env.GOOGLE_CLIENT_ID) {
        googleClientId = encrypt(process.env.GOOGLE_CLIENT_ID);
      }
      if (process.env.GOOGLE_CLIENT_SECRET) {
        googleClientSecret = encrypt(process.env.GOOGLE_CLIENT_SECRET);
      }
    } catch (encryptError) {
      console.warn("⚠️  ENCRYPTION_KEY not set. API keys will be stored unencrypted.");
      console.warn("   Set ENCRYPTION_KEY environment variable for secure storage.");
      
      // Fallback: store unencrypted (not recommended for production)
      openaiApiKey = process.env.OPENAI_API_KEY;
      geminiApiKey = process.env.GEMINI_API_KEY;
      googleTranslateApiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
      resendApiKey = process.env.RESEND_API_KEY;
      sendgridApiKey = process.env.SENDGRID_API_KEY;
      sesAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
      sesSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      smtpPassword = process.env.SMTP_PASSWORD;
      googleClientId = process.env.GOOGLE_CLIENT_ID;
      googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    }

    await db.insert(organizationSettings).values({
      id: settingsId,
      organizationId: orgId,
      // Email configuration
      emailProvider: process.env.EMAIL_PROVIDER as any || null,
      emailFrom: process.env.EMAIL_FROM || null,
      emailFromName: process.env.EMAIL_FROM_NAME || null,
      smtpHost: process.env.SMTP_HOST || null,
      smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : null,
      smtpUser: process.env.SMTP_USER || null,
      smtpPassword: smtpPassword || null,
      smtpSecure: process.env.SMTP_SECURE !== "false",
      resendApiKey: resendApiKey || null,
      sendgridApiKey: sendgridApiKey || null,
      sesAccessKeyId: sesAccessKeyId || null,
      sesSecretAccessKey: sesSecretAccessKey || null,
      sesRegion: process.env.AWS_REGION || null,
      // AI configuration
      openaiApiKey: openaiApiKey || null,
      geminiApiKey: geminiApiKey || null,
      googleTranslateApiKey: googleTranslateApiKey || null,
      // Auth configuration
      allowedEmailDomains: process.env.ALLOWED_EMAIL_DOMAINS || null,
      googleClientId: googleClientId || null,
      googleClientSecret: googleClientSecret || null,
      // Feature flags
      emailNotificationsEnabled: process.env.EMAIL_NOTIFICATIONS_ENABLED !== "false",
      aiTranslationEnabled: process.env.AI_TRANSLATION_ENABLED !== "false",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log("✅ Created organization settings\n");

    // Step 6: Update user.organizationId (primary organization)
    console.log("🔗 Setting primary organization for users...");
    
    for (const user of allUsers) {
      await db
        .update(users)
        .set({ organizationId: orgId })
        .where(eq(users.id, user.id));
    }
    
    console.log(`✅ Updated ${allUsers.length} users with primary organization\n`);

    console.log("✅ Multi-tenant migration completed successfully!");
    console.log(`\n📊 Summary:`);
    console.log(`   - Organization: ${defaultOrgName} (${defaultOrg.id})`);
    console.log(`   - Users assigned: ${allUsers.length}`);
    console.log(`   - Projects migrated: ${allProjects.length}`);
    console.log(`   - Settings created: Yes`);
    console.log(`\n🎉 Migration complete!`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration
migrateToMultiTenant()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

