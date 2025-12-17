/**
 * Organization access control and security utilities
 * Ensures data isolation between organizations
 */

import { db } from "@/lib/db";
import { organizations, organizationMembers, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NotFoundError, AuthorizationError } from "@/lib/errors";

// Use AuthorizationError as ForbiddenError
const ForbiddenError = AuthorizationError;

export interface OrganizationAccess {
  organizationId: string;
  role: "owner" | "admin" | "member";
  isOwner: boolean;
  isAdmin: boolean;
}

/**
 * Get user's organization membership
 */
export async function getUserOrganizationAccess(
  userId: string,
  organizationId: string
): Promise<OrganizationAccess | null> {
  const membership = await db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!membership || membership.length === 0) {
    return null;
  }

  const member = membership[0];
  return {
    organizationId: member.organizationId,
    role: member.role as "owner" | "admin" | "member",
    isOwner: member.role === "owner",
    isAdmin: member.role === "owner" || member.role === "admin",
  };
}

/**
 * Verify user has access to an organization
 * Throws ForbiddenError if user doesn't have access
 */
export async function verifyOrganizationAccess(
  userId: string,
  organizationId: string,
  requireAdmin: boolean = false
): Promise<OrganizationAccess> {
  const access = await getUserOrganizationAccess(userId, organizationId);

  if (!access) {
    throw new ForbiddenError("You don't have access to this organization");
  }

  if (requireAdmin && !access.isAdmin) {
    throw new ForbiddenError("Admin access required");
  }

  return access;
}

/**
 * Verify user has access to a project (through organization)
 */
export async function verifyProjectAccess(
  userId: string,
  projectId: string,
  requireAdmin: boolean = false
): Promise<{ project: typeof projects.$inferSelect; access: OrganizationAccess }> {
  // Get project with organization
  const projectData = await db
    .select({
      project: projects,
      organizationId: projects.organizationId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!projectData || projectData.length === 0) {
    throw new NotFoundError("Project");
  }

  const project = projectData[0].project;
  const access = await verifyOrganizationAccess(
    userId,
    project.organizationId,
    requireAdmin
  );

  return { project, access };
}

/**
 * Get all organizations a user belongs to
 */
export async function getUserOrganizations(userId: string) {
  return await db
    .select({
      organization: organizations,
      membership: organizationMembers,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId));
}

/**
 * Get user's primary organization (first one they joined, or organization they own)
 */
export async function getUserPrimaryOrganization(userId: string) {
  const orgs = await getUserOrganizations(userId);
  
  // Prefer organization where user is owner
  const ownedOrg = orgs.find((o) => o.membership.role === "owner");
  if (ownedOrg) {
    return ownedOrg.organization;
  }

  // Otherwise return first organization
  return orgs.length > 0 ? orgs[0].organization : null;
}

/**
 * Check if user can access organization resource
 * Used in middleware and API routes
 */
export async function canAccessOrganization(
  userId: string,
  organizationId: string,
  requiredRole?: "owner" | "admin" | "member"
): Promise<boolean> {
  const access = await getUserOrganizationAccess(userId, organizationId);
  
  if (!access) {
    return false;
  }

  if (!requiredRole) {
    return true;
  }

  const roleHierarchy = { owner: 3, admin: 2, member: 1 };
  return roleHierarchy[access.role] >= roleHierarchy[requiredRole];
}

