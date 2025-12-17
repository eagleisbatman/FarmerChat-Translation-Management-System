import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translations, translationKeys, translationHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { canApproveTranslation, canEditTranslation } from "@/lib/workflow";
import { nanoid } from "nanoid";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

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
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const body = await request.json();
    const data = updateTranslationSchema.parse(body);

    // Get existing translation with key to get projectId
    const [existing] = await db
      .select({
        translation: translations,
        key: translationKeys,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(eq(translations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(formatErrorResponse(new Error("Translation not found")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, existing.key.projectId);

    const existingTranslation = existing.translation;

    // Check permissions
    if (data.state && data.state !== existingTranslation.state) {
      if (data.state === "approved" && !canApproveTranslation(session.user.role, existingTranslation.state)) {
        return NextResponse.json(formatErrorResponse(new Error("Forbidden")), { status: 403 });
      }
    }

    if (data.value && !canEditTranslation(session.user.role, existingTranslation.state, existingTranslation.createdBy, session.user.id)) {
      return NextResponse.json(formatErrorResponse(new Error("Forbidden")), { status: 403 });
    }

    // Save to history before updating
    await db.insert(translationHistory).values({
      id: nanoid(),
      translationId: id,
      value: data.value || existingTranslation.value,
      state: data.state || existingTranslation.state,
      changedBy: session.user.id,
    });

    const [updated] = await db
      .update(translations)
      .set({
        ...data,
        reviewedBy: data.state === "approved" ? session.user.id : existingTranslation.reviewedBy,
        updatedAt: new Date(),
      })
      .where(eq(translations.id, id))
      .returning();

    // Invalidate cache when translation is updated or approved
    if (key && (data.value || data.state === "approved")) {
      const { invalidateTranslationCache } = await import("@/lib/cache/invalidation");
      const { languages } = await import("@/lib/db/schema");
      const [language] = await db
        .select()
        .from(languages)
        .where(eq(languages.id, updated.languageId))
        .limit(1);
      
      if (language) {
        await invalidateTranslationCache(key.projectId, language.code);
      }
    }

    // Get project ID for notifications
    const [key] = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.id, updated.keyId))
      .limit(1);

    // Trigger notifications based on state changes
    if (key && data.state && data.state !== existingTranslation.state) {
      const { notifyReviewRequest, notifyTranslationApproved, notifyTranslationRejected } = await import("@/lib/notifications/triggers");
      
      if (data.state === "review") {
        await notifyReviewRequest(id, key.projectId);
      } else if (data.state === "approved") {
        await notifyTranslationApproved(id, key.projectId);
      } else if (data.state === "draft" && existingTranslation.state === "review") {
        // Translation was rejected (moved back to draft from review)
        await notifyTranslationRejected(id, key.projectId);
      }
    }

    // Dispatch webhook events
    if (key) {
      const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
      const { createWebhookEvent } = await import("@/lib/webhooks/events");
      
      // Get language code for webhook payload
      const { languages } = await import("@/lib/db/schema");
      const [language] = await db
        .select()
        .from(languages)
        .where(eq(languages.id, updated.languageId))
        .limit(1);

      if (data.value && data.value !== existingTranslation.value) {
        // Translation updated
        const event = createWebhookEvent("translation.updated", key.projectId, {
          translationId: id,
          keyId: updated.keyId,
          key: key.key,
          languageCode: language?.code || "",
          oldValue: existingTranslation.value,
          newValue: updated.value,
          state: updated.state,
          updatedBy: session.user.id,
        });
        await dispatchWebhookEvent(key.projectId, event);
      }

      if (data.state && data.state !== existingTranslation.state) {
        if (data.state === "approved") {
          const event = createWebhookEvent("translation.approved", key.projectId, {
            translationId: id,
            keyId: updated.keyId,
            key: key.key,
            languageCode: language?.code || "",
            value: updated.value,
            approvedBy: session.user.id,
          });
          await dispatchWebhookEvent(key.projectId, event);
        } else if (data.state === "draft" && existingTranslation.state === "review") {
          // Translation rejected
          const event = createWebhookEvent("translation.rejected", key.projectId, {
            translationId: id,
            keyId: updated.keyId,
            key: key.key,
            languageCode: language?.code || "",
            value: updated.value,
            rejectedBy: session.user.id,
          });
          await dispatchWebhookEvent(key.projectId, event);
        }
      }
    }

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
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error updating translation:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
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
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Get translation with key to verify project access
    const [translationData] = await db
      .select({
        translation: translations,
        key: translationKeys,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(eq(translations.id, id))
      .limit(1);

    if (!translationData) {
      return NextResponse.json(formatErrorResponse(new Error("Translation not found")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, translationData.key.projectId);

    return NextResponse.json(translationData.translation);
  } catch (error) {
    console.error("Error fetching translation:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

