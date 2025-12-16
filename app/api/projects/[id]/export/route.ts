import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages, projectLanguages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { exportToXLIFF12, exportToXLIFF20 } from "@/lib/formats/xliff";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    const format = request.nextUrl.searchParams.get("format") || "json";
    const lang = request.nextUrl.searchParams.get("lang");

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get all approved translations
    const conditions = [
      eq(translationKeys.projectId, id),
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

    const allTranslations = await db
      .select({
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

    // Format based on requested format
    if (format === "json") {
      const grouped: Record<string, Record<string, string>> = {};
      
      for (const t of allTranslations) {
        const ns = t.namespace || "default";
        if (!grouped[ns]) {
          grouped[ns] = {};
        }
        grouped[ns][t.key] = t.value;
      }

      return NextResponse.json(grouped, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${project.name}-translations.json"`,
        },
      });
    }

    if (format === "csv") {
      const csvRows = ["Key,Language,Namespace,Value"];
      
      for (const t of allTranslations) {
        const escapedValue = `"${t.value.replace(/"/g, '""')}"`;
        csvRows.push(`${t.key},${t.language},${t.namespace || ""},${escapedValue}`);
      }

      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${project.name}-translations.csv"`,
        },
      });
    }

    if (format === "xliff12" || format === "xliff20") {
      // Get source language (default language)
      const [sourceLang] = await db
        .select()
        .from(languages)
        .where(eq(languages.id, project.defaultLanguageId || ""))
        .limit(1);

      if (!sourceLang) {
        return NextResponse.json({ error: "Source language not found" }, { status: 400 });
      }

      // Group translations by target language
      const translationsByLang: Record<string, typeof allTranslations> = {};
      for (const t of allTranslations) {
        if (!translationsByLang[t.language]) {
          translationsByLang[t.language] = [];
        }
        translationsByLang[t.language].push(t);
      }

      // Export each target language as separate XLIFF file
      // For now, export first target language or all combined
      const targetLangCode = lang || Object.keys(translationsByLang)[0] || "en";
      const targetTranslations = translationsByLang[targetLangCode] || allTranslations;

      const xliffData = (format === "xliff12" ? exportToXLIFF12 : exportToXLIFF20)(
        targetTranslations.map((t) => ({
          key: t.key,
          source: t.value, // In XLIFF, source is the original language
          target: t.value, // Target is the translation
          note: t.description || undefined,
          namespace: t.namespace || undefined,
        })),
        sourceLang.code,
        targetLangCode
      );

      return new NextResponse(xliffData, {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": `attachment; filename="${project.name}-${targetLangCode}.${format === "xliff12" ? "xliff" : "xlf"}"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    console.error("Error exporting translations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

