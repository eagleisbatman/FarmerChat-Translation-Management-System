export const ALLOWED_EMAIL_DOMAINS = (
  process.env.ALLOWED_EMAIL_DOMAINS || "digitalgreen.org,digitalgreentrust.org"
)
  .split(",")
  .map((domain) => domain.trim());

/**
 * Check if email is allowed (organization-level or global)
 * For multi-tenant: checks organization settings first, then falls back to global
 */
export async function isEmailAllowed(email: string, organizationId?: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  // If organization ID provided, check organization settings first
  if (organizationId) {
    const { getOrganizationSettings } = await import("./organizations/settings");
    const settings = await getOrganizationSettings(organizationId);
    
    if (settings?.allowedEmailDomains && settings.allowedEmailDomains.length > 0) {
      return settings.allowedEmailDomains.includes(domain);
    }
  }

  // Fallback to global allowed domains
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use isEmailAllowed with organizationId instead
 */
export function isEmailAllowedSync(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

