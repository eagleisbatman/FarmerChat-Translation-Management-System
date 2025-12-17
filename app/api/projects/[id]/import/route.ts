import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages, projectLanguages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
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
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "translator") {
      return NextResponse.json(formatErrorResponse(new Error("Forbidden")), { status: 403 });
    }

    // Verify user has access to project's organization
    const { project } = await verifyProjectAccess(session.user.id, id);

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
      } else {
        format = "json"; // Default fallback
      }
    }

    const text = await file.text();
    let parsedData: Array<{
      key: string;
      value: string;
      namespace?: string;
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
          // Array format
          for (const item of jsonData) {
            if (item.key && item.value) {
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
          formatErrorResponse(new ValidationError(`Invalid JSON file: ${jsonError instanceof Error ? jsonError.message : "Unknown error"}`)),
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
          description: unit.note,
        }));
      } catch (xliffError) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError(`Invalid XLIFF file: ${xliffError instanceof Error ? xliffError.message : "Unknown error"}`)),
          { status: 400 }
        );
      }
    } else if (format === "po" || format === "pot") {
      try {
        const gettextData = parseGettext(text);
        parsedData = gettextData.translations;
      } catch (gettextError) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError(`Invalid Gettext file: ${gettextError instanceof Error ? gettextError.message : "Unknown error"}`)),
          { status: 400 }
        );
      }
    } else if (format === "strings") {
      try {
        parsedData = parseStrings(text);
      } catch (stringsError) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError(`Invalid .strings file: ${stringsError instanceof Error ? stringsError.message : "Unknown error"}`)),
          { status: 400 }
        );
      }
    } else if (format === "stringsdict") {
      try {
        parsedData = parseStringsDict(text);
      } catch (stringsDictError) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError(`Invalid .stringsdict file: ${stringsDictError instanceof Error ? stringsDictError.message : "Unknown error"}`)),
          { status: 400 }
        );
      }
    } else if (format === "arb") {
      try {
        const arbData = parseARB(text);
        parsedData = arbData.translations;
      } catch (arbError) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError(`Invalid ARB file: ${arbError instanceof Error ? arbError.message : "Unknown error"}`)),
          { status: 400 }
        );
      }
    } else if (format === "android-xml") {
      try {
        parsedData = await parseAndroidXML(text);
      } catch (androidError) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError(`Invalid Android XML file: ${androidError instanceof Error ? androidError.message : "Unknown error"}`)),
          { status: 400 }
        );
      }
    } else if (format === "resx") {
      try {
        parsedData = await parseRESX(text);
      } catch (resxError) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError(`Invalid RESX file: ${resxError instanceof Error ? resxError.message : "Unknown error"}`)),
          { status: 400 }
        );
      }
    } else if (format === "yaml" || format === "yml") {
      try {
        const yamlData = parseYAML(text);
        parsedData = yamlData.translations;
      } catch (yamlError) {
        return NextResponse.json(
          formatErrorResponse(new ValidationError(`Invalid YAML file: ${yamlError instanceof Error ? yamlError.message : "Unknown error"}`)),
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(formatErrorResponse(new ValidationError(`Unsupported format: ${format}`)), { status: 400 });
    }

    // Get default language
    const [defaultLang] = await db
      .select()
      .from(languages)
      .where(eq(languages.id, project.defaultLanguageId || ""))
      .limit(1);

    if (!defaultLang) {
      return NextResponse.json(formatErrorResponse(new ValidationError("Default language not found")), { status: 400 });
    }

    const createdKeys: string[] = [];
    const createdTranslations: string[] = [];

    // Process parsed data
    for (const item of parsedData) {
      // Check if key already exists
      const [existingKey] = await db
        .select()
        .from(translationKeys)
        .where(
          and(
            eq(translationKeys.projectId, id),
            eq(translationKeys.key, item.key)
          )
        )
        .limit(1);

      let keyId: string;
      if (existingKey) {
        keyId = existingKey.id;
      } else {
        const [newKey] = await db
          .insert(translationKeys)
          .values({
            id: nanoid(),
            projectId: id,
            key: item.key,
            namespace: item.namespace || null,
            description: item.description || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        keyId = newKey.id;
        createdKeys.push(item.key);
      }

      // Check if translation already exists
      const [existingTranslation] = await db
        .select()
        .from(translations)
        .where(
          and(
            eq(translations.keyId, keyId),
            eq(translations.languageId, defaultLang.id)
          )
        )
        .limit(1);

      if (!existingTranslation) {
        await db.insert(translations).values({
          id: nanoid(),
          keyId,
          languageId: defaultLang.id,
          value: item.value,
          state: project.requiresReview ? "draft" : "approved",
          createdBy: session.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        createdTranslations.push(item.key);
      }
    }

    return NextResponse.json({
      success: true,
      keysCreated: createdKeys.length,
      translationsCreated: createdTranslations.length,
    });
  } catch (error) {
    console.error("Error importing translations:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

