import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translations, translationKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { canCreateTranslation } from "@/lib/workflow";

const createTranslationSchema = z.object({
  projectId: z.string(),
  keyId: z.string(),
  languageId: z.string(),
  value: z.string().min(1),
  state: z.enum(["draft", "review", "approved"]).default("draft"),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!canCreateTranslation(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = createTranslationSchema.parse(body);

    // Verify key belongs to project
    const [key] = await db
      .select()
      .from(translationKeys)
      .where(
        and(
          eq(translationKeys.id, data.keyId),
          eq(translationKeys.projectId, data.projectId)
        )
      )
      .limit(1);

    if (!key) {
      return NextResponse.json({ error: "Invalid key or project" }, { status: 400 });
    }

    // Check if translation already exists
    const [existing] = await db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.keyId, data.keyId),
          eq(translations.languageId, data.languageId)
        )
      )
      .limit(1);

    if (existing) {
      // Update existing translation
      const [updated] = await db
        .update(translations)
        .set({
          value: data.value,
          state: data.state,
          updatedAt: new Date(),
        })
        .where(eq(translations.id, existing.id))
        .returning();

      return NextResponse.json(updated);
    } else {
      // Create new translation
      const [newTranslation] = await db
        .insert(translations)
        .values({
          id: nanoid(),
          keyId: data.keyId,
          languageId: data.languageId,
          value: data.value,
          state: data.state,
          createdBy: session.user.id,
        })
        .returning();

      return NextResponse.json(newTranslation, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating translation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

