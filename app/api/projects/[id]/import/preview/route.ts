import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { parseXLIFF } from "@/lib/formats/xliff";
import { parseGettext } from "@/lib/formats/gettext";
import { parseStrings, parseStringsDict } from "@/lib/formats/strings";
import { parseARB } from "@/lib/formats/arb";
import { parseAndroidXML } from "@/lib/formats/android-xml";
import { parseRESX } from "@/lib/formats/resx";
import { parseYAML } from "@/lib/formats/yaml";
import csv from "csv-parser";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    let format = formData.get("format") as string;

    if (!file) {
      return NextResponse.json(formatErrorResponse(new ValidationError("No file provided")), { status: 400 });
    }

    // Auto-detect format from file extension if not provided
    if (!format) {
      const fileName = file.name.toLowerCase();
      if (fileName.endsWith(".po") || fileName.endsWith(".pot")) {
        format = "po";
      } else if (fileName.endsWith(".strings")) {
        format = "strings";
      } else if (fileName.endsWith(".stringsdict")) {
        format = "stringsdict";
      } else if (fileName.endsWith(".arb")) {
        format = "arb";
      } else if (fileName.endsWith(".xml") && fileName.includes("strings")) {
        format = "android-xml";
      } else if (fileName.endsWith(".resx")) {
        format = "resx";
      } else if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
        format = "yaml";
      } else if (fileName.endsWith(".xliff") || fileName.endsWith(".xlf")) {
        format = "xliff";
      } else if (fileName.endsWith(".csv")) {
        format = "csv";
      } else if (fileName.endsWith(".json")) {
        format = "json";
      } else {
        format = "json"; // Default fallback
      }
    }

    // Verify user has access to project's organization
    const { project } = await verifyProjectAccess(session.user.id, projectId);

    const text = await file.text();
    let parsedData: Array<{
      key: string;
      value: string;
      namespace?: string;
      languageCode?: string;
      description?: string;
    }> = [];

    // Parse file based on format
    if (format === "json") {
      try {
        const jsonData = JSON.parse(text);
        if (typeof jsonData === "object" && !Array.isArray(jsonData)) {
          // Nested namespace structure
          for (const [namespace, translations] of Object.entries(jsonData)) {
            if (typeof translations === "object" && translations !== null) {
              for (const [key, value] of Object.entries(translations)) {
                if (typeof value === "string") {
                  parsedData.push({
                    key,
                    value,
                    namespace: namespace === "default" ? undefined : namespace,
                  });
                }
              }
            }
          }
        } else if (Array.isArray(jsonData)) {
          // Array format (bulk upload format)
          for (const item of jsonData) {
            if (item.translations && typeof item.translations === "object") {
              // Extract first translation value for preview
              const firstLang = Object.keys(item.translations)[0];
              parsedData.push({
                key: item.key,
                value: item.translations[firstLang] || "",
                namespace: item.namespace,
                description: item.description,
              });
            } else if (item.value) {
              parsedData.push({
                key: item.key,
                value: item.value,
                namespace: item.namespace,
                description: item.description,
              });
            }
          }
        }
      } catch (jsonError) {
        return NextResponse.json(
          { error: `Invalid JSON file: ${jsonError instanceof Error ? jsonError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else if (format === "csv") {
      const results: any[] = [];
      const readable = Readable.from(text);
      const parser = readable.pipe(csv());

      parser.on("data", (data) => results.push(data));
      await finished(parser);

      for (const row of results) {
        if (row.Key && row.Value) {
          parsedData.push({
            key: row.Key,
            value: row.Value,
            namespace: row.Namespace || undefined,
            languageCode: row.Language || undefined,
            description: row.Description || undefined,
          });
        }
      }
    } else if (format === "xliff") {
      try {
        const xliffData = parseXLIFF(text);
        parsedData = xliffData.units.map((unit) => ({
          key: unit.id,
          value: unit.target || unit.source,
          namespace: unit.context?.value,
          languageCode: xliffData.targetLanguage,
          description: unit.note,
        }));
      } catch (xliffError) {
        return NextResponse.json(
          { error: `Invalid XLIFF file: ${xliffError instanceof Error ? xliffError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else if (format === "po" || format === "pot") {
      try {
        const gettextData = parseGettext(text);
        parsedData = gettextData.translations;
      } catch (gettextError) {
        return NextResponse.json(
          { error: `Invalid Gettext file: ${gettextError instanceof Error ? gettextError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else if (format === "strings") {
      try {
        parsedData = parseStrings(text);
      } catch (stringsError) {
        return NextResponse.json(
          { error: `Invalid .strings file: ${stringsError instanceof Error ? stringsError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else if (format === "stringsdict") {
      try {
        parsedData = parseStringsDict(text);
      } catch (stringsDictError) {
        return NextResponse.json(
          { error: `Invalid .stringsdict file: ${stringsDictError instanceof Error ? stringsDictError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else if (format === "arb") {
      try {
        const arbData = parseARB(text);
        parsedData = arbData.translations;
      } catch (arbError) {
        return NextResponse.json(
          { error: `Invalid ARB file: ${arbError instanceof Error ? arbError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else if (format === "android-xml") {
      try {
        parsedData = await parseAndroidXML(text);
      } catch (androidError) {
        return NextResponse.json(
          { error: `Invalid Android XML file: ${androidError instanceof Error ? androidError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else if (format === "resx") {
      try {
        parsedData = await parseRESX(text);
      } catch (resxError) {
        return NextResponse.json(
          { error: `Invalid RESX file: ${resxError instanceof Error ? resxError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else if (format === "yaml" || format === "yml") {
      try {
        const yamlData = parseYAML(text);
        parsedData = yamlData.translations;
      } catch (yamlError) {
        return NextResponse.json(
          { error: `Invalid YAML file: ${yamlError instanceof Error ? yamlError.message : "Unknown error"}` },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(formatErrorResponse(new ValidationError(`Unsupported format: ${format}`)), { status: 400 });
    }

    // Get existing keys for conflict detection
    const existingKeys = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.projectId, projectId));

    const existingKeysMap = new Map(existingKeys.map((k) => [k.key, k]));

    // Analyze conflicts
    const conflicts: Array<{
      key: string;
      existingValue?: string;
      newValue: string;
      namespace?: string;
    }> = [];
    const newKeys: string[] = [];

    for (const item of parsedData) {
      const existingKey = existingKeysMap.get(item.key);
      if (existingKey) {
        // Check if translation exists
        const [existingTranslation] = await db
          .select()
          .from(translations)
          .where(
            and(
              eq(translations.keyId, existingKey.id),
              eq(translations.languageId, project.defaultLanguageId || "")
            )
          )
          .limit(1);

        if (existingTranslation && existingTranslation.value !== item.value) {
          conflicts.push({
            key: item.key,
            existingValue: existingTranslation.value,
            newValue: item.value,
            namespace: item.namespace,
          });
        }
      } else {
        newKeys.push(item.key);
      }
    }

    return NextResponse.json({
      totalKeys: parsedData.length,
      newKeys: newKeys.length,
      conflicts: conflicts.length,
      conflictDetails: conflicts.slice(0, 20), // Limit to first 20 for preview
      sample: parsedData.slice(0, 10), // Sample data for preview
      format,
    });
  } catch (error) {
    console.error("Error generating import preview:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

