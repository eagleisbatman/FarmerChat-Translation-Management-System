import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages, projectLanguages } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError } from "@/lib/errors";
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
    const namespacesParam = request.nextUrl.searchParams.get("namespaces");

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

    if (namespacesParam) {
      const namespaceList = namespacesParam.split(",").filter(Boolean);
      if (namespaceList.length > 0) {
        conditions.push(inArray(translationKeys.namespace, namespaceList));
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
      .where(and(...conditions))
      .limit(100); // Limit for preview

    // Get total counts (simplified - just count the results we have)
    const totalKeysResult = await db
      .select({ id: translationKeys.id })
      .from(translationKeys)
      .where(eq(translationKeys.projectId, id));
    
    const totalKeys = totalKeysResult.length;

    const totalTranslationsResult = await db
      .select({ id: translations.id })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(and(...conditions));
    
    const totalTranslations = totalTranslationsResult.length;

    // Generate sample based on format
    let sample: Record<string, string | Record<string, string>> = {};
    let structure = "";

    if (format === "json") {
      const grouped: Record<string, Record<string, string>> = {};
      for (const t of allTranslations.slice(0, 10)) {
        const ns = t.namespace || "default";
        if (!grouped[ns]) {
          grouped[ns] = {};
        }
        grouped[ns][t.key] = t.value;
      }
      sample = grouped;
      structure = "Nested object with namespaces as keys";
    } else if (format === "csv") {
      sample = {
        headers: ["Key", "Language", "Namespace", "Value"],
        rows: allTranslations.slice(0, 5).map((t) => [
          t.key,
          t.language,
          t.namespace || "",
          t.value.substring(0, 50) + (t.value.length > 50 ? "..." : ""),
        ]),
      };
      structure = "CSV with columns: Key, Language, Namespace, Value";
    } else if (format === "xliff12" || format === "xliff20") {
      sample = {
        version: format === "xliff12" ? "1.2" : "2.0",
        sourceLanguage: project.defaultLanguageId || "en",
        targetLanguage: lang || "en",
        units: allTranslations.slice(0, 3).map((t) => ({
          id: t.key,
          source: t.value.substring(0, 50),
          target: t.value.substring(0, 50),
        })),
      };
      structure = `XLIFF ${format === "xliff12" ? "1.2" : "2.0"} XML format`;
    } else if (format === "po" || format === "pot") {
      sample = {
        format: "po",
        entries: allTranslations.slice(0, 3).map((t) => ({
          msgid: t.key,
          msgstr: t.value.substring(0, 50),
        })),
      };
      structure = "Gettext .po format with msgid/msgstr pairs";
    } else if (format === "strings") {
      sample = {
        format: "strings",
        entries: allTranslations.slice(0, 3).map((t) => ({
          key: t.key,
          value: t.value.substring(0, 50),
        })),
      };
      structure = "Apple .strings format";
    } else if (format === "arb") {
      sample = {
        format: "arb",
        locale: lang || "en",
        entries: allTranslations.slice(0, 3).reduce((acc, t) => {
          acc[t.key] = t.value.substring(0, 50);
          return acc;
        }, {} as Record<string, string>),
      };
      structure = "Flutter ARB JSON format";
    } else if (format === "android-xml") {
      sample = {
        format: "android-xml",
        entries: allTranslations.slice(0, 3).map((t) => ({
          name: t.key,
          value: t.value.substring(0, 50),
        })),
      };
      structure = "Android strings.xml format";
    } else if (format === "resx") {
      sample = {
        format: "resx",
        entries: allTranslations.slice(0, 3).map((t) => ({
          name: t.key,
          value: t.value.substring(0, 50),
        })),
      };
      structure = ".NET RESX XML format";
    } else if (format === "yaml" || format === "yml") {
      const yamlSample: Record<string, string | Record<string, string>> = {};
      const langCode = lang || "en";
      yamlSample[langCode] = {};
      for (const t of allTranslations.slice(0, 3)) {
        const ns = t.namespace || "default";
        if (!yamlSample[langCode][ns]) {
          yamlSample[langCode][ns] = {};
        }
        yamlSample[langCode][ns][t.key] = t.value.substring(0, 50);
      }
      sample = yamlSample;
      structure = "YAML format (Rails i18n style)";
    }

    return NextResponse.json({
      format,
      language: lang || "all",
      totalKeys,
      totalTranslations,
      sample,
      structure,
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

