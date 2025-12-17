/**
 * Organization-level authentication utilities
 * Handles OAuth configuration and email domain checking per organization
 */

import { getOrganizationSettings } from "./settings";
import { isEmailAllowed } from "@/lib/auth-config";

/**
 * Get OAuth credentials for an organization
 * Falls back to environment variables if not configured
 */
export async function getOrganizationOAuthCredentials(organizationId: string): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  const settings = await getOrganizationSettings(organizationId);

  // Use organization-level OAuth if configured
  if (settings?.googleClientId && settings?.googleClientSecret) {
    return {
      clientId: settings.googleClientId,
      clientSecret: settings.googleClientSecret,
    };
  }

  // Fallback to environment variables
  return {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  };
}

/**
 * Check if email is allowed for an organization
 * Uses organization-level email domain restrictions if configured
 */
export async function isEmailAllowedForOrganization(
  email: string,
  organizationId: string
): Promise<boolean> {
  return await isEmailAllowed(email, organizationId);
}

