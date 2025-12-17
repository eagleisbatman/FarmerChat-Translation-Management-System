import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, translations, translationKeys, projects, projectMembers } from "@/lib/db/schema";
import { eq, or, ilike, SQL } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";

/**
 * Get users for @mention autocomplete
 * GET /api/comments/users?translationId=xxx&query=john
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), {
        status: 401,
      });
    }

    const translationId = request.nextUrl.searchParams.get("translationId");
    const query = request.nextUrl.searchParams.get("query") || "";

    if (!translationId) {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("translationId is required")),
        { status: 400 }
      );
    }

    // Get project ID from translation and verify access
    const [translationWithKey] = await db
      .select({
        translation: translations,
        key: translationKeys,
        project: projects,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(projects, eq(translationKeys.projectId, projects.id))
      .where(eq(translations.id, translationId))
      .limit(1);

    if (!translationWithKey) {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("Translation not found")),
        { status: 404 }
      );
    }

    const projectId = translationWithKey.key.projectId;

    // Verify user has access to project's organization
    const { verifyProjectAccess } = await import("@/lib/security/organization-access");
    await verifyProjectAccess(session.user.id, projectId);

    // Get project members first (prioritize them)
    const projectMembersData = await db
      .select({
        userId: projectMembers.userId,
        user: users,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId));

    const memberUserIds = projectMembersData.map((m) => m.userId);

    // Build query conditions
    const conditions: SQL[] = [];

    if (query) {
      conditions.push(
        or(
          ilike(users.name, `%${query}%`),
          ilike(users.email, `%${query}%`)
        )
      );
    }

    // Get all users (or filtered by query)
    let allUsers;
    if (conditions.length > 0) {
      allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(users)
        .where(or(...conditions))
        .limit(20);
    } else {
      allUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(users)
        .limit(20);
    }

    // Sort: project members first, then others
    const sortedUsers = allUsers.sort((a, b) => {
      const aIsMember = memberUserIds.includes(a.id);
      const bIsMember = memberUserIds.includes(b.id);
      if (aIsMember && !bIsMember) return -1;
      if (!aIsMember && bIsMember) return 1;
      return 0;
    });

    return NextResponse.json({
      users: sortedUsers.map((user) => ({
        id: user.id,
        name: user.name || "",
        email: user.email || "",
        image: user.image,
        isProjectMember: memberUserIds.includes(user.id),
      })),
    });
  } catch (error) {
    console.error("Error fetching users for mentions:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

