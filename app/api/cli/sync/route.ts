import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cliTokens, projects, translationKeys, translations, languages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { nanoid } from "nanoid";
import { notifyReviewRequest } from "@/lib/notifications/triggers";

/**
 * Verify CLI token
 */
async function verifyCliToken(request: NextRequest): Promise<{ userId: string }> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    throw new AuthenticationError("CLI token is required");
  }

  const [cliToken] = await db
    .select()
    .from(cliTokens)
    .where(eq(cliTokens.token, token))
    .limit(1);

  if (!cliToken || new Date(cliToken.expiresAt) < new Date()) {
    throw new AuthenticationError("Invalid or expired CLI token");
  }

  return { userId: cliToken.userId };
}

/**
 * Pull translations from the server
 * GET /api/cli/sync?projectId=xxx&lang=en&namespace=common
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await verifyCliToken(request);
    const projectId = request.nextUrl.searchParams.get("projectId");
    const lang = request.nextUrl.searchParams.get("lang");
    const namespace = request.nextUrl.searchParams.get("namespace");

    if (!projectId) {
      throw new ValidationError("projectId is required");
    }

    // Verify user has access to project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new ValidationError("Project not found");
    }

    // Build query conditions
    const conditions = [
      eq(translationKeys.projectId, projectId),
      eq(translations.state, "approved"),
    ];

    if (lang) {
      const [language] = await db
        .select()
        .from(languages)
        .where(eq(languages.code, lang))
        .limit(1);
      
      if (language) {
        conditions.push(eq(translations.languageId, language.id));
      }
    }

    if (namespace) {
      conditions.push(eq(translationKeys.namespace, namespace));
    }

    // Fetch translations
    const results = await db
      .select({
        key: translationKeys.key,
        value: translations.value,
        language: languages.code,
        namespace: translationKeys.namespace,
        description: translationKeys.description,
        deprecated: translationKeys.deprecated,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(languages, eq(translations.languageId, languages.id))
      .where(and(...conditions));

    // Format response
    const responseData: Record<string, Record<string, string>> = {};
    const metadata: Record<string, { description?: string; deprecated?: boolean }> = {};

    for (const row of results) {
      const ns = row.namespace || "default";
      if (!responseData[ns]) {
        responseData[ns] = {};
      }
      responseData[ns][row.key] = row.value;
      
      const keyPath = `${ns}.${row.key}`;
      if (!metadata[keyPath]) {
        metadata[keyPath] = {};
      }
      if (row.description) {
        metadata[keyPath].description = row.description;
      }
      if (row.deprecated) {
        metadata[keyPath].deprecated = true;
      }
    }

    return NextResponse.json({
      translations: responseData,
      metadata,
      project: {
        id: project.id,
        name: project.name,
      },
    });
  } catch (error) {
    console.error("Error pulling translations:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

/**
 * Push translations to the server
 * POST /api/cli/sync
 * Body: { projectId, translations: { namespace: { key: value } }, lang?, deprecate?: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await verifyCliToken(request);
    const body = await request.json();
    const { projectId, translations: translationsData, lang, deprecate } = body;

    if (!projectId || !translationsData) {
      throw new ValidationError("projectId and translations are required");
    }

    // Verify user has access to project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new ValidationError("Project not found");
    }

    // Get default language if lang not specified
    let targetLanguageId = project.defaultLanguageId;
    if (lang) {
      const [language] = await db
        .select()
        .from(languages)
        .where(eq(languages.code, lang))
        .limit(1);
      
      if (language) {
        targetLanguageId = language.id;
      }
    }

    if (!targetLanguageId) {
      throw new ValidationError("No target language specified");
    }

    const results = {
      keysCreated: 0,
      keysUpdated: 0,
      translationsCreated: 0,
      translationsUpdated: 0,
      deprecated: 0,
    };

    // Process translations
    for (const [namespace, keys] of Object.entries(translationsData)) {
      if (typeof keys !== "object" || keys === null) continue;

      for (const [key, value] of Object.entries(keys)) {
        if (typeof value !== "string") continue;

        // Find or create translation key
        let [translationKey] = await db
          .select()
          .from(translationKeys)
          .where(
            and(
              eq(translationKeys.projectId, projectId),
              eq(translationKeys.key, key),
              eq(translationKeys.namespace, namespace || null)
            )
          )
          .limit(1);

        if (!translationKey) {
          // Create new key
          const newKeyId = nanoid();
          const [createdKey] = await db.insert(translationKeys).values({
            id: newKeyId,
            projectId,
            key,
            namespace: namespace || null,
            description: null,
            deprecated: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
          translationKey = createdKey;
          results.keysCreated++;
        } else {
          // Update key (clear deprecated flag if it was deprecated)
          if (translationKey.deprecated) {
            await db
              .update(translationKeys)
              .set({ deprecated: false, updatedAt: new Date() })
              .where(eq(translationKeys.id, translationKey.id));
          }
          results.keysUpdated++;
        }

        // Find or create translation
        const [existingTranslation] = await db
          .select()
          .from(translations)
          .where(
            and(
              eq(translations.keyId, translationKey.id),
              eq(translations.languageId, targetLanguageId)
            )
          )
          .limit(1);

        if (existingTranslation) {
          // Update existing translation
          await db
            .update(translations)
            .set({
              value,
              updatedAt: new Date(),
            })
            .where(eq(translations.id, existingTranslation.id));
          results.translationsUpdated++;

          // If updating to review state, notify reviewers
          if (existingTranslation.state === "draft" && project.requiresReview) {
            await db
              .update(translations)
              .set({ state: "review" })
              .where(eq(translations.id, existingTranslation.id));
            await notifyReviewRequest(existingTranslation.id, projectId);
          }
        } else {
          // Create new translation
          const newTranslationId = nanoid();
          await db.insert(translations).values({
            id: newTranslationId,
            keyId: translationKey.id,
            languageId: targetLanguageId,
            value,
            state: project.requiresReview ? "review" : "draft",
            createdBy: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          results.translationsCreated++;

          // Notify reviewers if review required
          if (project.requiresReview) {
            await notifyReviewRequest(newTranslationId, projectId);
          }
        }
      }
    }

    // Handle deprecation
    if (Array.isArray(deprecate) && deprecate.length > 0) {
      for (const keyPath of deprecate) {
        const [namespace, key] = keyPath.includes(".") 
          ? keyPath.split(".", 2)
          : ["default", keyPath];

        await db
          .update(translationKeys)
          .set({ deprecated: true, updatedAt: new Date() })
          .where(
            and(
              eq(translationKeys.projectId, projectId),
              eq(translationKeys.key, key),
              eq(translationKeys.namespace, namespace === "default" ? null : namespace)
            )
          );
        results.deprecated++;
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error("Error pushing translations:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

