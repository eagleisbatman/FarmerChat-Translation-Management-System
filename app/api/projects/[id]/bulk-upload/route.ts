import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { formatErrorResponse, ValidationError, NotFoundError, AuthenticationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const bulkUploadSchema = z.object({
  keys: z.array(z.object({
    key: z.string().min(1),
    namespace: z.string().optional(),
    description: z.string().optional(),
    translations: z.record(z.string(), z.string()), // language code -> value
  })),
  conflictResolution: z.record(z.string(), z.enum(["skip", "overwrite", "merge"])).optional(), // key -> resolution strategy
  dryRun: z.boolean().optional().default(false), // If true, validate without importing
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: projectId } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        formatErrorResponse(new ValidationError("Invalid JSON in request body")),
        { status: 400 }
      );
    }

    const data = bulkUploadSchema.parse(body);

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, projectId);

    const conflictResolution = data.conflictResolution || {};
    const dryRun = data.dryRun || false;

    let keysCreated = 0;
    let translationsCreated = 0;
    let translationsUpdated = 0;
    let keysSkipped = 0;
    const errors: string[] = [];

    // Use transaction to ensure atomicity of bulk operations
    // This prevents race conditions where partial data is written if an error occurs mid-way
    const result = await db.transaction(async (tx) => {
      // Get all existing keys upfront for efficiency
      const existingKeys = await tx
        .select()
        .from(translationKeys)
        .where(eq(translationKeys.projectId, projectId));
      
      const existingKeysMap = new Map(existingKeys.map((k) => [k.key, k]));

      // Process each key
      for (const keyData of data.keys) {
        const resolution = conflictResolution[keyData.key] || "overwrite"; // Default to overwrite
        
        // Check if key already exists
        const existingKey = existingKeysMap.get(keyData.key);

        // Handle conflict resolution
        if (existingKey && resolution === "skip") {
          keysSkipped++;
          continue;
        }

        let keyId: string;
        if (existingKey) {
          keyId = existingKey.id;
          // Update namespace/description if provided and resolution is overwrite or merge
          if (resolution !== "skip" && (keyData.namespace !== undefined || keyData.description !== undefined)) {
            if (!dryRun) {
              await tx
                .update(translationKeys)
                .set({
                  namespace: keyData.namespace !== undefined ? keyData.namespace : existingKey.namespace,
                  description: keyData.description !== undefined ? keyData.description : existingKey.description,
                  updatedAt: new Date(),
                })
                .where(eq(translationKeys.id, keyId));
            }
          }
        } else {
          if (!dryRun) {
            // Create new key
            const [newKey] = await tx
              .insert(translationKeys)
              .values({
                id: nanoid(),
                projectId,
                key: keyData.key,
                namespace: keyData.namespace,
                description: keyData.description,
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              .returning();
            keyId = newKey.id;
          } else {
            keyId = existingKey?.id || "new"; // Use existing key ID or mark as new
          }
          if (!existingKey) {
            keysCreated++;
          }
        }

        // Get existing translations for this key (for both dry-run and actual import)
        const existingTranslations = existingKey
          ? await tx
              .select()
              .from(translations)
              .where(eq(translations.keyId, existingKey.id))
          : [];

        const existingTranslationsMap = new Map(
          existingTranslations.map((t) => [t.languageId, t])
        );

        // Create/update translations for each language
        for (const [langCode, value] of Object.entries(keyData.translations)) {
          // Get language ID (languages table is read-only, can use db)
          const [language] = await db
            .select()
            .from(languages)
            .where(eq(languages.code, langCode))
            .limit(1);

          if (!language) {
            errors.push(`Language ${langCode} not found for key ${keyData.key}`);
            continue;
          }

          const existingTranslation = existingTranslationsMap.get(language.id);

          if (existingTranslation) {
            // Translation exists - apply conflict resolution
            if (resolution === "skip") {
              keysSkipped++;
              continue; // Skip this translation
            } else if (resolution === "merge") {
              // Merge: only update if new value is different and not empty
              if (!dryRun && value && value !== existingTranslation.value) {
                await tx
                  .update(translations)
                  .set({
                    value,
                    updatedAt: new Date(),
                  })
                  .where(eq(translations.id, existingTranslation.id));
              }
              translationsUpdated++;
            } else {
              // Overwrite: always update
              if (!dryRun) {
                await tx
                  .update(translations)
                  .set({
                    value,
                    updatedAt: new Date(),
                  })
                  .where(eq(translations.id, existingTranslation.id));
              }
              translationsUpdated++;
            }
          } else {
            // New translation
            if (!dryRun) {
              await tx.insert(translations).values({
                id: nanoid(),
                keyId: existingKey?.id || keyId,
                languageId: language.id,
                value,
                state: "draft",
                createdBy: session.user.id,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
            translationsCreated++;
          }
        }
      }

      return {
        success: true,
        dryRun,
        keysCreated,
        translationsCreated,
        translationsUpdated,
        keysSkipped,
        errors: errors.length > 0 ? errors : undefined,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorResponse = formatErrorResponse(
        new ValidationError(
          "Invalid request data",
          "Please check that your file matches the expected format."
        )
      );
      return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
    }
    console.error("Error bulk uploading:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

