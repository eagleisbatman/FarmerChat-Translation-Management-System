export const ALLOWED_EMAIL_DOMAINS = (
  process.env.ALLOWED_EMAIL_DOMAINS || "digitalgreen.org,digitalgreentrust.org"
)
  .split(",")
  .map((domain) => domain.trim());

export function isEmailAllowed(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

