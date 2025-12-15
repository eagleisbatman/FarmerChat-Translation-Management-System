import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translations, translationKeys, translationHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { canApproveTranslation, canEditTranslation } from "@/lib/workflow";
import { nanoid } from "nanoid";

const updateTranslationSchema = z.object({
  value: z.string().min(1).optional(),
  state: z.enum(["draft", "review", "approved"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = updateTranslationSchema.parse(body);

    // Get existing translation
    const [existing] = await db
      .select()
      .from(translations)
      .where(eq(translations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Translation not found" }, { status: 404 });
    }

    // Check permissions
    if (data.state && data.state !== existing.state) {
      if (data.state === "approved" && !canApproveTranslation(session.user.role, existing.state)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (data.value && !canEditTranslation(session.user.role, existing.state, existing.createdBy, session.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Save to history before updating
    await db.insert(translationHistory).values({
      id: nanoid(),
      translationId: id,
      value: data.value || existing.value,
      state: data.state || existing.state,
      changedBy: session.user.id,
    });

    const [updated] = await db
      .update(translations)
      .set({
        ...data,
        reviewedBy: data.state === "approved" ? session.user.id : existing.reviewedBy,
        updatedAt: new Date(),
      })
      .where(eq(translations.id, id))
      .returning();

    // If approved, add to translation memory
    if (data.state === "approved" && updated) {
      const { TranslationMemoryService } = await import("@/lib/translation-memory");
      const memoryService = new TranslationMemoryService();
      
      // Get key and project info
      const [key] = await db
        .select()
        .from(translationKeys)
        .where(eq(translationKeys.id, updated.keyId))
        .limit(1);

      if (key) {
        // This would need project default language - simplified for now
        // In production, you'd sync all approved translations
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error updating translation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [translation] = await db
      .select()
      .from(translations)
      .where(eq(translations.id, id))
      .limit(1);

    if (!translation) {
      return NextResponse.json({ error: "Translation not found" }, { status: 404 });
    }

    return NextResponse.json(translation);
  } catch (error) {
    console.error("Error fetching translation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

