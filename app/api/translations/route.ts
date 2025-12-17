import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translations, translationKeys } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { canCreateTranslation } from "@/lib/workflow";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

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
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    if (!canCreateTranslation(session.user.role)) {
      return NextResponse.json(formatErrorResponse(new Error("Forbidden")), { status: 403 });
    }

    const body = await request.json();
    const data = createTranslationSchema.parse(body);

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, data.projectId);

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
      return NextResponse.json(formatErrorResponse(new ValidationError("Invalid key or project")), { status: 400 });
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

      // Dispatch webhook event for translation creation
      const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
      const { createWebhookEvent } = await import("@/lib/webhooks/events");
      const { languages } = await import("@/lib/db/schema");
      
      const [language] = await db
        .select()
        .from(languages)
        .where(eq(languages.id, data.languageId))
        .limit(1);

      const event = createWebhookEvent("translation.created", data.projectId, {
        translationId: newTranslation.id,
        keyId: data.keyId,
        key: key.key,
        languageCode: language?.code || "",
        value: data.value,
        state: data.state,
        createdBy: session.user.id,
      });
      await dispatchWebhookEvent(data.projectId, event);

      // Invalidate cache if translation is approved
      if (data.state === "approved" && language) {
        const { invalidateTranslationCache } = await import("@/lib/cache/invalidation");
        await invalidateTranslationCache(data.projectId, language.code);
      }

      return NextResponse.json(newTranslation, { status: 201 });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error creating translation:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

