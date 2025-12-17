import { db } from "@/lib/db";
import { organizations, organizationMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getUserPrimaryOrganization, getUserOrganizations } from "@/lib/security/organization-access";

export interface OrganizationContext {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: "owner" | "admin" | "member";
  isOwner: boolean;
  isAdmin: boolean;
}

/**
 * Get organization context from URL or session
 * Extracts organization ID from URL patterns like:
 * - /organizations/[id]/...
 * - /projects/[id]/... (gets org from project)
 */
export async function getOrganizationContext(
  userId: string,
  pathname: string,
  projectId?: string
): Promise<OrganizationContext | null> {
  // Extract organization ID from URL
  const orgMatch = pathname.match(/^\/organizations\/([^\/]+)/);
  if (orgMatch) {
    const orgId = orgMatch[1];
    return await getOrganizationContextById(userId, orgId);
  }

  // Extract from project ID if provided
  if (projectId) {
    const { project } = await import("@/lib/db/schema");
    const [projectData] = await db
      .select({ organizationId: project.organizationId })
      .from(project)
      .where(eq(project.id, projectId))
      .limit(1);

    if (projectData) {
      return await getOrganizationContextById(userId, projectData.organizationId);
    }
  }

  // Fallback to primary organization
  const primaryOrg = await getUserPrimaryOrganization(userId);
  if (primaryOrg) {
    return await getOrganizationContextById(userId, primaryOrg.id);
  }

  return null;
}

/**
 * Get organization context by organization ID
 */
export async function getOrganizationContextById(
  userId: string,
  organizationId: string
): Promise<OrganizationContext | null> {
  const [orgData] = await db
    .select({
      organization: organizations,
      membership: organizationMembers,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (!orgData) {
    return null;
  }

  return {
    organizationId: orgData.organization.id,
    organizationName: orgData.organization.name,
    organizationSlug: orgData.organization.slug,
    role: orgData.membership.role as "owner" | "admin" | "member",
    isOwner: orgData.membership.role === "owner",
    isAdmin: orgData.membership.role === "owner" || orgData.membership.role === "admin",
  };
}

/**
 * Auto-join user to organization based on email domain
 * This is called after user creation to automatically add them to matching organizations
 */
export async function autoJoinOrganizationByDomain(
  userId: string,
  email: string
): Promise<string | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) {
    return null;
  }

  // Find organization with matching domain
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.domain, domain))
    .limit(1);

  if (!org) {
    return null;
  }

  // Check if user is already a member
  const [existing] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, org.id),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);

  if (existing) {
    // Update user's primary organization if not set
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user && !user.organizationId) {
      await db
        .update(users)
        .set({ organizationId: org.id, updatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    return org.id;
  }

  // Add user as member
  const { nanoid } = await import("nanoid");
  await db.insert(organizationMembers).values({
    id: nanoid(),
    organizationId: org.id,
    userId: userId,
    role: "member",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Update user's primary organization if not set
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user && !user.organizationId) {
    await db
      .update(users)
      .set({ organizationId: org.id, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  return org.id;
}

/**
 * Get organization context from request headers (set by middleware)
 */
export function getOrganizationContextFromHeaders(
  headers: Headers
): { organizationId?: string; role?: string } {
  return {
    organizationId: headers.get("x-organization-id") || undefined,
    role: headers.get("x-organization-role") || undefined,
  };
}

