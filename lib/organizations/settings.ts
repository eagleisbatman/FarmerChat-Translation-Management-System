/**
 * Organization settings service
 * Manages organization-level configuration (email, AI, auth)
 */

import { db } from "@/lib/db";
import { organizationSettings, organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { encrypt, decrypt } from "@/lib/security/encryption";

export interface EmailConfig {
  provider: "smtp" | "resend" | "sendgrid" | "ses" | null;
  from?: string;
  fromName?: string;
  smtp?: {
    host: string;
    port: number;
    user: string;
    password: string;
    secure: boolean;
  };
  resendApiKey?: string;
  sendgridApiKey?: string;
  ses?: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
}

export interface AIConfig {
  openaiApiKey?: string;
  geminiApiKey?: string;
  googleTranslateApiKey?: string;
}

export interface AuthConfig {
  allowedEmailDomains?: string[];
  googleClientId?: string;
  googleClientSecret?: string;
}

export interface OrganizationSettingsInput {
  email?: EmailConfig;
  ai?: AIConfig;
  auth?: AuthConfig;
  emailNotificationsEnabled?: boolean;
  aiTranslationEnabled?: boolean;
}

/**
 * Get organization settings
 */
export async function getOrganizationSettings(organizationId: string) {
  const [settings] = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, organizationId))
    .limit(1);

  if (!settings) {
    return null;
  }

  // Decrypt sensitive fields
  return {
    ...settings,
    smtpPassword: settings.smtpPassword ? decrypt(settings.smtpPassword) : null,
    resendApiKey: settings.resendApiKey ? decrypt(settings.resendApiKey) : null,
    sendgridApiKey: settings.sendgridApiKey ? decrypt(settings.sendgridApiKey) : null,
    sesAccessKeyId: settings.sesAccessKeyId ? decrypt(settings.sesAccessKeyId) : null,
    sesSecretAccessKey: settings.sesSecretAccessKey ? decrypt(settings.sesSecretAccessKey) : null,
    openaiApiKey: settings.openaiApiKey ? decrypt(settings.openaiApiKey) : null,
    geminiApiKey: settings.geminiApiKey ? decrypt(settings.geminiApiKey) : null,
    googleTranslateApiKey: settings.googleTranslateApiKey ? decrypt(settings.googleTranslateApiKey) : null,
    googleClientId: settings.googleClientId ? decrypt(settings.googleClientId) : null,
    googleClientSecret: settings.googleClientSecret ? decrypt(settings.googleClientSecret) : null,
    allowedEmailDomains: settings.allowedEmailDomains
      ? settings.allowedEmailDomains.split(",").map((d) => d.trim())
      : [],
  };
}

/**
 * Update organization settings
 */
export async function updateOrganizationSettings(
  organizationId: string,
  input: OrganizationSettingsInput
) {
  const existing = await getOrganizationSettings(organizationId);

  const updateData: Partial<typeof organizationSettings.$inferInsert> = {
    updatedAt: new Date(),
  };

  // Email configuration
  if (input.email) {
    updateData.emailProvider = input.email.provider || null;
    updateData.emailFrom = input.email.from || null;
    updateData.emailFromName = input.email.fromName || null;

    if (input.email.smtp) {
      updateData.smtpHost = input.email.smtp.host || null;
      updateData.smtpPort = input.email.smtp.port || null;
      updateData.smtpUser = input.email.smtp.user || null;
      updateData.smtpPassword = input.email.smtp.password ? encrypt(input.email.smtp.password) : null;
      updateData.smtpSecure = input.email.smtp.secure ?? true;
    }

    if (input.email.resendApiKey) {
      updateData.resendApiKey = encrypt(input.email.resendApiKey);
    }

    if (input.email.sendgridApiKey) {
      updateData.sendgridApiKey = encrypt(input.email.sendgridApiKey);
    }

    if (input.email.ses) {
      updateData.sesAccessKeyId = encrypt(input.email.ses.accessKeyId);
      updateData.sesSecretAccessKey = encrypt(input.email.ses.secretAccessKey);
      updateData.sesRegion = input.email.ses.region || null;
    }
  }

  // AI configuration
  if (input.ai) {
    if (input.ai.openaiApiKey !== undefined) {
      updateData.openaiApiKey = input.ai.openaiApiKey ? encrypt(input.ai.openaiApiKey) : null;
    }
    if (input.ai.geminiApiKey !== undefined) {
      updateData.geminiApiKey = input.ai.geminiApiKey ? encrypt(input.ai.geminiApiKey) : null;
    }
    if (input.ai.googleTranslateApiKey !== undefined) {
      updateData.googleTranslateApiKey = input.ai.googleTranslateApiKey
        ? encrypt(input.ai.googleTranslateApiKey)
        : null;
    }
  }

  // Auth configuration
  if (input.auth) {
    if (input.auth.allowedEmailDomains) {
      updateData.allowedEmailDomains = input.auth.allowedEmailDomains.join(",");
    }
    if (input.auth.googleClientId !== undefined) {
      updateData.googleClientId = input.auth.googleClientId ? encrypt(input.auth.googleClientId) : null;
    }
    if (input.auth.googleClientSecret !== undefined) {
      updateData.googleClientSecret = input.auth.googleClientSecret
        ? encrypt(input.auth.googleClientSecret)
        : null;
    }
  }

  // Feature flags
  if (input.emailNotificationsEnabled !== undefined) {
    updateData.emailNotificationsEnabled = input.emailNotificationsEnabled;
  }
  if (input.aiTranslationEnabled !== undefined) {
    updateData.aiTranslationEnabled = input.aiTranslationEnabled;
  }

  if (existing) {
    // Update existing
    const [updated] = await db
      .update(organizationSettings)
      .set(updateData)
      .where(eq(organizationSettings.organizationId, organizationId))
      .returning();

    return updated;
  } else {
    // Create new
    const [created] = await db
      .insert(organizationSettings)
      .values({
        id: nanoid(),
        organizationId,
        ...updateData,
      })
      .returning();

    return created;
  }
}

/**
 * Get decrypted AI API keys for use in services
 */
export async function getDecryptedAIKeys(organizationId: string): Promise<{
  openaiApiKey?: string;
  geminiApiKey?: string;
  googleTranslateApiKey?: string;
}> {
  const settings = await getOrganizationSettings(organizationId);
  
  if (!settings) {
    return {};
  }

  return {
    openaiApiKey: settings.openaiApiKey || undefined,
    geminiApiKey: settings.geminiApiKey || undefined,
    googleTranslateApiKey: settings.googleTranslateApiKey || undefined,
  };
}

