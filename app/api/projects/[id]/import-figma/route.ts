import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import { fetchFigmaTextNodes, figmaNodesToTranslationKeys } from "@/lib/formats/figma";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const figmaImportSchema = z.object({
  accessToken: z.string().min(1),
  fileKey: z.string().min(1),
  nodeIds: z.array(z.string()).optional(),
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

    const body = await request.json();
    const data = figmaImportSchema.parse(body);

    // Verify user has access to project's organization
    const { project } = await verifyProjectAccess(session.user.id, projectId);

    // Get default language
    const [defaultLang] = await db
      .select()
      .from(languages)
      .where(eq(languages.id, project.defaultLanguageId || ""))
      .limit(1);

    if (!defaultLang) {
      return NextResponse.json(formatErrorResponse(new ValidationError("Default language not found")), { status: 400 });
    }

    // Fetch text nodes from Figma
    const figmaNodes = await fetchFigmaTextNodes({
      accessToken: data.accessToken,
      fileKey: data.fileKey,
      nodeIds: data.nodeIds,
    });

    // Convert to translation keys
    const translationKeysData = figmaNodesToTranslationKeys(figmaNodes, projectId);

    let keysCreated = 0;
    let translationsCreated = 0;

    // Create keys and translations
    for (const keyData of translationKeysData) {
      // Check if key exists
      const existingKeys = await db
        .select()
        .from(translationKeys)
        .where(eq(translationKeys.projectId, projectId));

      const existingKey = existingKeys.find((k) => k.key === keyData.key);

      let keyId: string;
      if (existingKey) {
        keyId = existingKey.id;
      } else {
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

      // Create translation for default language
      const existingTranslations = await db
        .select()
        .from(translations)
        .where(eq(translations.keyId, keyId));

      const existingTranslation = existingTranslations.find(
        (t) => t.languageId === defaultLang.id
      );

      if (!existingTranslation) {
        await db.insert(translations).values({
          id: nanoid(),
          keyId,
          languageId: defaultLang.id,
          value: keyData.sourceText,
          state: "draft",
          createdBy: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        translationsCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      keysCreated,
      translationsCreated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error importing from Figma:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

