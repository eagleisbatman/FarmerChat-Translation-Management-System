import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, translations, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const createCommentSchema = z.object({
  translationId: z.string(),
  content: z.string().min(1).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createCommentSchema.parse(body);

    // Verify translation exists
    const [translation] = await db
      .select()
      .from(translations)
      .where(eq(translations.id, data.translationId))
      .limit(1);

    if (!translation) {
      return NextResponse.json({ error: "Translation not found" }, { status: 404 });
    }

    const [newComment] = await db
      .insert(comments)
      .values({
        id: nanoid(),
        translationId: data.translationId,
        userId: session.user.id,
        content: data.content,
      })
      .returning();

    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const translationId = request.nextUrl.searchParams.get("translationId");

    if (!translationId) {
      return NextResponse.json({ error: "translationId is required" }, { status: 400 });
    }

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

