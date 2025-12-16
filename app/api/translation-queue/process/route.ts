import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationQueue, translations, projects, languages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AutoTranslateService } from "@/lib/auto-translate";
import { handleQueueError, getQueueHealth } from "@/lib/queue-error-handler";
import { formatErrorResponse } from "@/lib/errors";

/**
 * Process pending translation queue items
 * This endpoint processes translations in batches
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can trigger queue processing
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const batchSize = body.batchSize || 10; // Process 10 at a time by default

    // Get pending queue items
    const pendingItems = await db
      .select()
      .from(translationQueue)
      .where(eq(translationQueue.status, "pending"))
      .limit(batchSize);

    if (pendingItems.length === 0) {
      return NextResponse.json({ message: "No pending translations to process" });
    }

    const autoTranslate = new AutoTranslateService();
    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
    };

    // Process each item
    for (const item of pendingItems) {
      try {
        // Mark as processing
        await db
          .update(translationQueue)
          .set({
            status: "processing",
            updatedAt: new Date(),
          })
          .where(eq(translationQueue.id, item.id));

        // Get project and languages
        const [project] = await db
          .select()
          .from(projects)
          .where(eq(projects.id, item.projectId))
          .limit(1);

        const [sourceLang] = await db
          .select()
          .from(languages)
          .where(eq(languages.id, item.sourceLanguageId))
          .limit(1);

        const [targetLang] = await db
          .select()
          .from(languages)
          .where(eq(languages.id, item.targetLanguageId))
          .limit(1);

        if (!project || !sourceLang || !targetLang) {
          throw new Error("Project or language not found");
        }

        // Translate using AI
        const translationResult = await autoTranslate.translate(
          {
            text: item.sourceText,
            sourceLanguage: sourceLang.code,
            targetLanguage: targetLang.code,
            imageUrl: item.imageUrl || undefined,
            context: `Translation key: ${item.keyId}`,
          },
          project.aiProvider || undefined,
          project.aiFallbackProvider || undefined
        );

        // Create or update translation
        const [existingTranslation] = await db
          .select()
          .from(translations)
          .where(
            and(
              eq(translations.keyId, item.keyId),
              eq(translations.languageId, item.targetLanguageId)
            )
          )
          .limit(1);

        if (existingTranslation) {
          await db
            .update(translations)
            .set({
              value: translationResult.translatedText,
              updatedAt: new Date(),
            })
            .where(eq(translations.id, existingTranslation.id));
        } else {
          await db.insert(translations).values({
            id: nanoid(),
            keyId: item.keyId,
            languageId: item.targetLanguageId,
            value: translationResult.translatedText,
            state: "draft",
            createdBy: item.createdBy,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // Update queue item as completed
        await db
          .update(translationQueue)
          .set({
            status: "completed",
            translatedText: translationResult.translatedText,
            provider: translationResult.provider,
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(translationQueue.id, item.id));

        results.succeeded++;
      } catch (error) {
        // Use centralized error handler with retry logic
        await handleQueueError(item.id, error, 0);
        results.failed++;
      }

      results.processed++;
    }

    const health = await getQueueHealth();

    return NextResponse.json({
      success: true,
      ...results,
      queueHealth: health,
    });
  } catch (error) {
    console.error("Error processing translation queue:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

