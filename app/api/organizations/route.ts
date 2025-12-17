import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizations, organizationMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { getUserOrganizations } from "@/lib/security/organization-access";

const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  domain: z.string().email().optional().or(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i)).optional(),
});

/**
 * GET /api/organizations
 * Get all organizations the user belongs to
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), {
        status: 401,
      });
    }

    const userOrgs = await getUserOrganizations(session.user.id);

    return NextResponse.json({
      organizations: userOrgs.map((uo) => ({
        id: uo.organization.id,
        name: uo.organization.name,
        slug: uo.organization.slug,
        domain: uo.organization.domain,
        logoUrl: uo.organization.logoUrl,
        role: uo.membership.role,
        createdAt: uo.organization.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

/**
 * POST /api/organizations
 * Create a new organization
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), {
        status: 401,
      });
    }

    const body = await request.json();
    const data = createOrganizationSchema.parse(body);

    // Check if slug already exists
    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, data.slug))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("Organization slug already exists")),
        { status: 409 }
      );
    }

    // Create organization
    const orgId = nanoid();
    const [newOrg] = await db
      .insert(organizations)
      .values({
        id: orgId,
        name: data.name,
        slug: data.slug,
        domain: data.domain || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Add creator as owner
    await db.insert(organizationMembers).values({
      id: nanoid(),
      organizationId: orgId,
      userId: session.user.id,
      role: "owner",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json(newOrg, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), {
        status: 400,
      });
    }
    console.error("Error creating organization:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

