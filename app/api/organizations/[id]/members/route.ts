import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizationMembers, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";
import { verifyOrganizationAccess } from "@/lib/security/organization-access";

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["owner", "admin", "member"]),
});

const updateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member"]),
});

/**
 * GET /api/organizations/[id]/members
 * Get all members of an organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Verify user has access to organization
    await verifyOrganizationAccess(session.user.id, id);

    const members = await db
      .select({
        member: organizationMembers,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(organizationMembers)
      .innerJoin(users, eq(organizationMembers.userId, users.id))
      .where(eq(organizationMembers.organizationId, id))
      .orderBy(organizationMembers.createdAt);

    return NextResponse.json(members);
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * POST /api/organizations/[id]/members
 * Add a member to an organization
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Verify user has admin access to organization
    await verifyOrganizationAccess(session.user.id, id, true);

    const body = await request.json();
    const data = addMemberSchema.parse(body);

    // Verify user exists
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, data.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("User")), { status: 404 });
    }

    // Check if already a member
    const [existing] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, id),
          eq(organizationMembers.userId, data.userId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("User is already a member of this organization")),
        { status: 409 }
      );
    }

    // Prevent adding owner role (only one owner allowed, must be set manually)
    if (data.role === "owner") {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("Cannot add owner role. Organization must have exactly one owner.")),
        { status: 400 }
      );
    }

    const [newMember] = await db
      .insert(organizationMembers)
      .values({
        id: nanoid(),
        organizationId: id,
        userId: data.userId,
        role: data.role,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error adding organization member:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * PATCH /api/organizations/[id]/members?userId=xxx
 * Update a member's role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const userIdToUpdate = request.nextUrl.searchParams.get("userId");

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    if (!userIdToUpdate) {
      return NextResponse.json(formatErrorResponse(new ValidationError("userId is required")), { status: 400 });
    }

    // Verify user has admin access to organization
    await verifyOrganizationAccess(session.user.id, id, true);

    const body = await request.json();
    const data = updateMemberSchema.parse(body);

    // Prevent changing to owner role (only one owner allowed)
    if (data.role === "owner") {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("Cannot set owner role. Organization must have exactly one owner.")),
        { status: 400 }
      );
    }

    // Prevent removing the last admin
    const [currentMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, id),
          eq(organizationMembers.userId, userIdToUpdate)
        )
      )
      .limit(1);

    if (!currentMember) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Organization member")), { status: 404 });
    }

    // Prevent demoting from owner role (organization must have exactly one owner)
    if (currentMember.role === "owner" && data.role !== "owner") {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("Cannot change owner role. Organization must have exactly one owner.")),
        { status: 400 }
      );
    }

    // If changing from admin to member, check if there are other admins
    if (currentMember.role === "admin" && data.role === "member") {
      const adminCount = await db
        .select({ count: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, id),
            eq(organizationMembers.role, "admin")
          )
        );

      if (adminCount.length <= 1) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError("Cannot remove the last admin from the organization")),
          { status: 400 }
        );
      }
    }

    const [updatedMember] = await db
      .update(organizationMembers)
      .set({
        role: data.role,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationMembers.organizationId, id),
          eq(organizationMembers.userId, userIdToUpdate)
        )
      )
      .returning();

    return NextResponse.json(updatedMember);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error updating organization member:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * DELETE /api/organizations/[id]/members?userId=xxx
 * Remove a member from an organization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const userIdToDelete = request.nextUrl.searchParams.get("userId");

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    if (!userIdToDelete) {
      return NextResponse.json(formatErrorResponse(new ValidationError("userId is required")), { status: 400 });
    }

    // Verify user has admin access to organization
    await verifyOrganizationAccess(session.user.id, id, true);

    // Prevent removing the last admin
    const [memberToDelete] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, id),
          eq(organizationMembers.userId, userIdToDelete)
        )
      )
      .limit(1);

    if (!memberToDelete) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Organization member")), { status: 404 });
    }

    if (memberToDelete.role === "admin") {
      const adminCount = await db
        .select({ count: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, id),
            eq(organizationMembers.role, "admin")
          )
        );

      if (adminCount.length <= 1) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError("Cannot remove the last admin from the organization")),
          { status: 400 }
        );
      }
    }

    // Prevent removing owner
    if (memberToDelete.role === "owner") {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("Cannot remove the organization owner")),
        { status: 400 }
      );
    }

    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, id),
          eq(organizationMembers.userId, userIdToDelete)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing organization member:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

