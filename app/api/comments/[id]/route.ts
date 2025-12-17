import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, translations, translationKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const updateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const body = await request.json();
    const data = updateCommentSchema.parse(body);

    // Get comment with translation and key to verify project access
    const [commentData] = await db
      .select({
        comment: comments,
        key: translationKeys,
      })
      .from(comments)
      .innerJoin(translations, eq(comments.translationId, translations.id))
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(eq(comments.id, id))
      .limit(1);

    if (!commentData) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Comment")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, commentData.key.projectId);

    const comment = commentData.comment;

    // Only allow author or admin to edit
    if (comment.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json(formatErrorResponse(new ForbiddenError("Only the comment author or an admin can edit this comment")), { status: 403 });
    }

    const [updated] = await db
      .update(comments)
      .set({
        content: data.content,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error updating comment:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Get comment with translation and key to verify project access
    const [commentData] = await db
      .select({
        comment: comments,
        key: translationKeys,
      })
      .from(comments)
      .innerJoin(translations, eq(comments.translationId, translations.id))
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(eq(comments.id, id))
      .limit(1);

    if (!commentData) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Comment")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, commentData.key.projectId);

    const comment = commentData.comment;

    // Only allow author or admin to delete
    if (comment.userId !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json(formatErrorResponse(new ForbiddenError("Only the comment author or an admin can delete this comment")), { status: 403 });
    }

    await db.delete(comments).where(eq(comments.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

