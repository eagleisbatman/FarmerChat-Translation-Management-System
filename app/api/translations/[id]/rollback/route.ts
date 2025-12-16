import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translations, translationHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";

const rollbackSchema = z.object({
  historyId: z.string(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "reviewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = rollbackSchema.parse(body);

    // Verify translation exists
    const [translation] = await db
      .select()
      .from(translations)
      .where(eq(translations.id, id))
      .limit(1);

    if (!translation) {
      return NextResponse.json({ error: "Translation not found" }, { status: 404 });
    }

    // Get the history entry to rollback to
    const [historyEntry] = await db
      .select()
      .from(translationHistory)
      .where(eq(translationHistory.id, data.historyId))
      .limit(1);

    if (!historyEntry) {
      return NextResponse.json({ error: "History entry not found" }, { status: 404 });
    }

    // Verify the history entry belongs to this translation
    if (historyEntry.translationId !== id) {
      return NextResponse.json(
        { error: "History entry does not belong to this translation" },
        { status: 400 }
      );
    }

    // Rollback: Update translation to the historical value and state
    const [rolledBack] = await db
      .update(translations)
      .set({
        value: historyEntry.value,
        state: historyEntry.state,
        updatedAt: new Date(),
      })
      .where(eq(translations.id, id))
      .returning();

    // Create a new history entry for the rollback action
    await db.insert(translationHistory).values({
      id: nanoid(),
      translationId: id,
      value: historyEntry.value,
      state: historyEntry.state,
      changedBy: session.user.id,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      translation: rolledBack,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error rolling back translation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

