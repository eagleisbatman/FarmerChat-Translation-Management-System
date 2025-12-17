import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const bulkDownloadSchema = z.object({
  keyIds: z.array(z.string()).min(1),
  format: z.enum(["json", "csv", "xliff12", "xliff20"]).default("json"),
  targetLanguageCode: z.string().optional(),
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
    const data = bulkDownloadSchema.parse(body);

    // Verify user has access to project's organization
    const { project } = await verifyProjectAccess(session.user.id, projectId);

    // Get translations for selected keys
    const conditions = [
      eq(translationKeys.projectId, projectId),
      inArray(translationKeys.id, data.keyIds),
      eq(translations.state, "approved"),
    ];

    if (data.targetLanguageCode) {
      const [targetLang] = await db
        .select()
        .from(languages)
        .where(eq(languages.code, data.targetLanguageCode))
        .limit(1);
      
      if (targetLang) {
        conditions.push(eq(translations.languageId, targetLang.id));
      }
    }

    const allTranslations = await db
      .select({
        keyId: translationKeys.id,
        key: translationKeys.key,
        value: translations.value,
        language: languages.code,
        namespace: translationKeys.namespace,
        description: translationKeys.description,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(languages, eq(translations.languageId, languages.id))
      .where(and(...conditions));

    // Format response based on format
    if (data.format === "json") {
      const grouped: Record<string, Record<string, string>> = {};
      
      for (const t of allTranslations) {
        const ns = t.namespace || "default";
        if (!grouped[ns]) {
          grouped[ns] = {};
        }
        grouped[ns][t.key] = t.value;
      }

      return NextResponse.json(grouped);
    }

    if (data.format === "csv") {
      const csvRows = ["Key,Language,Namespace,Value"];
      
      for (const t of allTranslations) {
        const escapedValue = `"${t.value.replace(/"/g, '""')}"`;
        csvRows.push(`${t.key},${t.language},${t.namespace || ""},${escapedValue}`);
      }

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="bulk-translations.csv"`,
        },
      });
    }

    if (data.format === "xliff12" || data.format === "xliff20") {
      const { exportToXLIFF12, exportToXLIFF20 } = await import("@/lib/formats/xliff");
      
      // Early return if no translations found
      if (allTranslations.length === 0) {
        return NextResponse.json(
          { error: "No approved translations found for the selected keys" },
          { status: 404 }
        );
      }

      // Get source language
      const [sourceLang] = await db
        .select()
        .from(languages)
        .where(eq(languages.id, project.defaultLanguageId || ""))
        .limit(1);

      if (!sourceLang) {
        return NextResponse.json(formatErrorResponse(new ValidationError("Source language not found")), { status: 400 });
      }

      // Extract unique key IDs from translations
      const keyIds = Array.from(new Set(allTranslations.map((t) => t.keyId)));

      // Fetch source language translations for all keys
      const sourceTranslations = await db
        .select({
          keyId: translationKeys.id,
          value: translations.value,
        })
        .from(translations)
        .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
        .where(
          and(
            eq(translationKeys.projectId, projectId),
            eq(translations.languageId, sourceLang.id),
            inArray(translationKeys.id, keyIds)
          )
        );

      // Create a map of keyId -> source text for quick lookup
      const sourceTextMap = new Map(
        sourceTranslations.map((st) => [st.keyId, st.value])
      );

      const targetLangCode = data.targetLanguageCode || "en";
      const xliffData = (data.format === "xliff12" ? exportToXLIFF12 : exportToXLIFF20)(
        allTranslations.map((t) => {
          const sourceText = sourceTextMap.get(t.keyId) || t.value;
          
          return {
            key: t.key,
            source: sourceText, // Source is the original language text
            target: t.value, // Target is the translation in target language
            note: t.description || undefined,
            namespace: t.namespace || undefined,
          };
        }),
        sourceLang.code,
        targetLangCode
      );

      return new NextResponse(xliffData, {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": `attachment; filename="bulk-translations.${data.format === "xliff12" ? "xliff" : "xlf"}"`,
        },
      });
    }

    return NextResponse.json(formatErrorResponse(new ValidationError("Unsupported format")), { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error bulk downloading:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

