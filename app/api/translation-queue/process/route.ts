import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationQueue, translations, projects, languages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AutoTranslateService } from "@/lib/auto-translate";
import { handleQueueError, getQueueHealth } from "@/lib/queue-error-handler";
import { formatErrorResponse, AuthenticationError, ForbiddenError } from "@/lib/errors";
import { verifyProjectAccess, getUserOrganizations } from "@/lib/security/organization-access";
import { inArray } from "drizzle-orm";

/**
 * Process pending translation queue items
 * This endpoint processes translations in batches
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Only admins can trigger queue processing
    if (session.user.role !== "admin") {
      return NextResponse.json(formatErrorResponse(new ForbiddenError("Only admins can process translation queue")), { status: 403 });
    }

    // Get user's organizations to filter queue items
    const userOrgs = await getUserOrganizations(session.user.id);
    const orgIds = userOrgs.map((o) => o.organization.id);
    
    if (orgIds.length === 0) {
      return NextResponse.json({ message: "No pending translations to process" });
    }

    // Get projects in user's organizations
    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.organizationId, orgIds));
    
    const projectIds = userProjects.map((p) => p.id);
    
    if (projectIds.length === 0) {
      return NextResponse.json({ message: "No pending translations to process" });
    }

    const body = await request.json();
    const batchSize = body.batchSize || 10; // Process 10 at a time by default

    // Get pending queue items for user's projects only
    const pendingItems = await db
      .select()
      .from(translationQueue)
      .where(
        and(
          eq(translationQueue.status, "pending"),
          inArray(translationQueue.projectId, projectIds)
        )
      )
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
        // Verify user still has access to this project (double-check)
        await verifyProjectAccess(session.user.id, item.projectId);

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

    // Notify user when batch completes (if any items were processed)
    if (results.processed > 0 && pendingItems.length > 0) {
      // Get the project ID from the first item
      const firstItem = pendingItems[0];
      const { notifyQueueCompleted } = await import("@/lib/notifications/triggers");
      
      // Notify the user who created the queue items (or current user if admin triggered)
      const userIdToNotify = session.user.id; // Admin who triggered the batch
      
      await notifyQueueCompleted(
        userIdToNotify,
        firstItem.projectId,
        results.succeeded,
        results.failed
      );

      // Dispatch webhook events grouped by project
      const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
      const { createWebhookEvent } = await import("@/lib/webhooks/events");
      
      // Group queue items by project
      const projectStats = new Map<string, { succeeded: number; failed: number; total: number }>();
      for (const item of pendingItems) {
        const stats = projectStats.get(item.projectId) || { succeeded: 0, failed: 0, total: 0 };
        stats.total++;
        if (item.status === "completed") {
          stats.succeeded++;
        } else if (item.status === "failed") {
          stats.failed++;
        }
        projectStats.set(item.projectId, stats);
      }

      // Dispatch webhook for each project
      for (const [projectId, stats] of projectStats.entries()) {
        if (stats.failed === 0) {
          // Queue completed successfully
          const event = createWebhookEvent("queue.completed", projectId, {
            queueId: `batch_${Date.now()}`,
            totalItems: stats.total,
            completedItems: stats.succeeded,
            failedItems: 0,
            completedBy: session.user.id,
          });
          await dispatchWebhookEvent(projectId, event);
        } else {
          // Queue completed with failures
          const event = createWebhookEvent("queue.failed", projectId, {
            queueId: `batch_${Date.now()}`,
            totalItems: stats.total,
            completedItems: stats.succeeded,
            failedItems: stats.failed,
            error: `${stats.failed} items failed to translate`,
          });
          await dispatchWebhookEvent(projectId, event);
        }
      }
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

