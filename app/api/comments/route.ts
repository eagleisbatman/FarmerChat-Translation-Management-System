import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, translations, users, translationKeys, projects, projectMembers } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { parseMentions } from "@/lib/utils/mentions";
import { notifyCommentMention } from "@/lib/notifications/triggers";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const createCommentSchema = z.object({
  translationId: z.string(),
  content: z.string().min(1).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("Invalid JSON in request body")),
        { status: 400 }
      );
    }

    const data = createCommentSchema.parse(body);

    // Get project ID from translation and verify access
    const translationWithKey = await db
      .select({
        translation: translations,
        key: translationKeys,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(eq(translations.id, data.translationId))
      .limit(1);

    if (!translationWithKey || translationWithKey.length === 0) {
      return NextResponse.json(formatErrorResponse(new ValidationError("Translation not found")), { status: 404 });
    }

    const projectId = translationWithKey[0].key.projectId;

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, projectId);

    // Get project members
    const members = await db
      .select({
        userId: projectMembers.userId,
        user: users,
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId));

    // Get users for @mention support (limit to 500 most recent users for performance)
    // This prevents loading all users which could cause memory issues with large user bases
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(500);

    // Create user map for mention parsing
    const userMap = new Map<string, { id: string; name: string; email: string }>();
    allUsers.forEach((user) => {
      userMap.set(user.id, {
        id: user.id,
        name: user.name || "",
        email: user.email || "",
      });
    });

    // Parse mentions from comment content
    const mentionedUserIds = parseMentions(data.content, userMap);

    const [newComment] = await db
      .insert(comments)
      .values({
        id: nanoid(),
        translationId: data.translationId,
        userId: session.user.id,
        content: data.content,
      })
      .returning();

    // Notify mentioned users
    for (const mentionedUserId of mentionedUserIds) {
      // Don't notify the comment author
      if (mentionedUserId !== session.user.id) {
        await notifyCommentMention(
          mentionedUserId,
          newComment.id,
          data.translationId,
          projectId,
          session.user.id
        );
      }
    }

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error creating comment:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const translationId = request.nextUrl.searchParams.get("translationId");

    if (!translationId) {
      return NextResponse.json(formatErrorResponse(new ValidationError("translationId is required")), { status: 400 });
    }

    // Get project ID from translation and verify access
    const [translationWithKey] = await db
      .select({
        translation: translations,
        key: translationKeys,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(eq(translations.id, translationId))
      .limit(1);

    if (!translationWithKey) {
      return NextResponse.json(formatErrorResponse(new ValidationError("Translation not found")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, translationWithKey.key.projectId);

    const allComments = await db
      .select({
        comment: comments,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.translationId, translationId))
      .orderBy(comments.createdAt);

    return NextResponse.json(allComments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

