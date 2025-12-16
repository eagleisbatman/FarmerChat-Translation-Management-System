import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { formatErrorResponse, ValidationError, NotFoundError } from "@/lib/errors";

const bulkUploadSchema = z.object({
  keys: z.array(z.object({
    key: z.string().min(1),
    namespace: z.string().optional(),
    description: z.string().optional(),
    translations: z.record(z.string(), z.string()), // language code -> value
  })),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id: projectId } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = bulkUploadSchema.parse(body);

    // Verify project exists
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      throw new NotFoundError("Project");
    }

    let keysCreated = 0;
    let translationsCreated = 0;

    // Process each key
    for (const keyData of data.keys) {
      // Check if key already exists
      const existingKeys = await db
        .select()
        .from(translationKeys)
        .where(eq(translationKeys.projectId, projectId));
      
      const existingKey = existingKeys.find((k) => k.key === keyData.key);

      let keyId: string;
      if (existingKey) {
        keyId = existingKey.id;
      } else {
        // Create new key
        const [newKey] = await db
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
        keysCreated++;
      }

      // Create/update translations for each language
      for (const [langCode, value] of Object.entries(keyData.translations)) {
        // Get language ID
        const [language] = await db
          .select()
          .from(languages)
          .where(eq(languages.code, langCode))
          .limit(1);

        if (!language) {
          console.warn(`Language ${langCode} not found, skipping`);
          continue;
        }

        // Check if translation exists
        const existingTranslations = await db
          .select()
          .from(translations)
          .where(eq(translations.keyId, keyId));
        
        const existingTranslation = existingTranslations.find(
          (t) => t.languageId === language.id
        );

        if (existingTranslation) {
          // Update existing translation
          await db
            .update(translations)
            .set({
              value,
              updatedAt: new Date(),
            })
            .where(eq(translations.id, existingTranslation.id));
        } else {
          // Create new translation
          await db.insert(translations).values({
            id: nanoid(),
            keyId,
            languageId: language.id,
            value,
            state: "draft",
            createdBy: session.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          translationsCreated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      keysCreated,
      translationsCreated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        "Invalid request data",
        "Please check that your file matches the expected format."
      );
    }
    console.error("Error bulk uploading:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

