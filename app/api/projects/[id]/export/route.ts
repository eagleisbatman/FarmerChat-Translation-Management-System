import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages, projectLanguages } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { exportToXLIFF12, exportToXLIFF20 } from "@/lib/formats/xliff";
import { exportToGettext } from "@/lib/formats/gettext";
import { exportToStrings } from "@/lib/formats/strings";
import { exportToARB } from "@/lib/formats/arb";
import { exportToAndroidXML } from "@/lib/formats/android-xml";
import { exportToRESX } from "@/lib/formats/resx";
import { exportToYAML } from "@/lib/formats/yaml";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

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
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Verify user has access to project's organization
    const { project } = await verifyProjectAccess(session.user.id, id);

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
      // Early return if no translations found
      if (allTranslations.length === 0) {
        return NextResponse.json(
          { error: "No approved translations found for export" },
          { status: 404 }
        );
      }

      // Get source language (default language)
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

      // Fetch source language translations for keys in allTranslations only
      const sourceTranslations = await db
        .select({
          keyId: translationKeys.id,
          key: translationKeys.key,
          value: translations.value,
        })
        .from(translations)
        .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
        .where(
          and(
            eq(translationKeys.projectId, id),
            eq(translations.languageId, sourceLang.id),
            inArray(translationKeys.id, keyIds)
          )
        );

      // Create a map of keyId -> source text for quick lookup
      const sourceTextMap = new Map(
        sourceTranslations.map((st) => [st.keyId, st.value])
      );

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
        targetTranslations.map((t) => {
          // Use keyId from the translation to find source text
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
          "Content-Disposition": `attachment; filename="${project.name}-${targetLangCode}.${format === "xliff12" ? "xliff" : "xlf"}"`,
        },
      });
    }

    if (format === "po" || format === "pot") {
      if (allTranslations.length === 0) {
        return NextResponse.json(
          { error: "No approved translations found for export" },
          { status: 404 }
        );
      }

      const [sourceLang] = await db
        .select()
        .from(languages)
        .where(eq(languages.id, project.defaultLanguageId || ""))
        .limit(1);

      if (!sourceLang) {
        return NextResponse.json(formatErrorResponse(new ValidationError("Source language not found")), { status: 400 });
      }

      const targetLangCode = lang || allTranslations[0]?.language || "en";
      const [targetLang] = await db
        .select()
        .from(languages)
        .where(eq(languages.code, targetLangCode))
        .limit(1);

      const poData = exportToGettext(
        allTranslations.map((t) => ({
          key: t.key,
          source: t.value, // For now, use value as source
          target: t.value,
          description: t.description || undefined,
          namespace: t.namespace || undefined,
        })),
        sourceLang.code,
        targetLang?.code || targetLangCode
      );

      return new NextResponse(poData, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${project.name}-${targetLangCode}.po"`,
        },
      });
    }

    if (format === "strings") {
      const stringsData = exportToStrings(
        allTranslations.map((t) => ({
          key: t.key,
          source: t.value,
          target: t.value,
          description: t.description || undefined,
        }))
      );

      return new NextResponse(stringsData, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${project.name}.strings"`,
        },
      });
    }

    if (format === "arb") {
      const targetLangCode = lang || allTranslations[0]?.language || "en";
      const arbData = exportToARB(
        allTranslations.map((t) => ({
          key: t.key,
          source: t.value,
          target: t.value,
          description: t.description || undefined,
          namespace: t.namespace || undefined,
        })),
        targetLangCode
      );

      return new NextResponse(arbData, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${project.name}-${targetLangCode}.arb"`,
        },
      });
    }

    if (format === "android-xml") {
      const androidData = exportToAndroidXML(
        allTranslations.map((t) => ({
          key: t.key,
          source: t.value,
          target: t.value,
          description: t.description || undefined,
        }))
      );

      return new NextResponse(androidData, {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": `attachment; filename="${project.name}-strings.xml"`,
        },
      });
    }

    if (format === "resx") {
      const resxData = exportToRESX(
        allTranslations.map((t) => ({
          key: t.key,
          source: t.value,
          target: t.value,
          description: t.description || undefined,
        }))
      );

      return new NextResponse(resxData, {
        headers: {
          "Content-Type": "application/xml",
          "Content-Disposition": `attachment; filename="${project.name}.resx"`,
        },
      });
    }

    if (format === "yaml" || format === "yml") {
      const targetLangCode = lang || allTranslations[0]?.language || "en";
      const yamlData = exportToYAML(
        allTranslations.map((t) => ({
          key: t.key,
          source: t.value,
          target: t.value,
          namespace: t.namespace || undefined,
        })),
        targetLangCode
      );

      return new NextResponse(yamlData, {
        headers: {
          "Content-Type": "text/yaml",
          "Content-Disposition": `attachment; filename="${project.name}-${targetLangCode}.yml"`,
        },
      });
    }

    return NextResponse.json(formatErrorResponse(new ValidationError(`Unsupported format: ${format}`)), { status: 400 });
  } catch (error) {
    console.error("Error exporting translations:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

