import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationQueue, projects, translationKeys, translations, languages, keyScreenshots } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { AutoTranslateService } from "@/lib/auto-translate";

const createQueueSchema = z.object({
  projectId: z.string(),
  keyIds: z.array(z.string()).min(1),
  targetLanguageIds: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createQueueSchema.parse(body);

    // Verify project exists
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, data.projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get source language
    const [sourceLang] = await db
      .select()
      .from(languages)
      .where(eq(languages.id, project.defaultLanguageId || ""))
      .limit(1);

    if (!sourceLang) {
      return NextResponse.json({ error: "Source language not found" }, { status: 400 });
    }

    // Get all keys and their source translations
    const keys = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.projectId, data.projectId));

    const sourceTranslations = await db
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.languageId, sourceLang.id),
          inArray(translations.keyId, data.keyIds)
        )
      );

    // Create queue entries
    const queueEntries = [];
    for (const keyId of data.keyIds) {
      const sourceTranslation = sourceTranslations.find((t) => t.keyId === keyId);
      if (!sourceTranslation) continue;

      // Get screenshots for context
      const [screenshot] = await db
        .select()
        .from(keyScreenshots)
        .where(eq(keyScreenshots.keyId, keyId))
        .limit(1);

      for (const targetLanguageId of data.targetLanguageIds) {
        // Check if translation already exists
        const [existing] = await db
          .select()
          .from(translations)
          .where(
            and(
              eq(translations.keyId, keyId),
              eq(translations.languageId, targetLanguageId)
            )
          )
          .limit(1);

        if (existing) continue; // Skip if already translated

        queueEntries.push({
          id: nanoid(),
          projectId: data.projectId,
          keyId,
          sourceLanguageId: sourceLang.id,
          targetLanguageId,
          sourceText: sourceTranslation.value,
          imageUrl: screenshot?.imageUrl || null,
          status: "pending" as const,
          createdBy: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (queueEntries.length === 0) {
      return NextResponse.json({ message: "No translations to queue" });
    }

    // Insert queue entries
    await db.insert(translationQueue).values(queueEntries);

    return NextResponse.json({
      success: true,
      queued: queueEntries.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating translation queue:", error);
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

    const { searchParams } = request.nextUrl;
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    const conditions = [];
    if (projectId) {
      conditions.push(eq(translationQueue.projectId, projectId));
    }
    if (status) {
      conditions.push(eq(translationQueue.status, status as any));
    }

    const queue = await db
      .select()
      .from(translationQueue)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(translationQueue.createdAt);

    return NextResponse.json(queue);
  } catch (error) {
    console.error("Error fetching translation queue:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

