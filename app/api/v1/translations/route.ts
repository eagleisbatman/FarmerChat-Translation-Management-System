import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-middleware";
import { db } from "@/lib/db";
import { translations, translationKeys, languages, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { valid, projectId, error } = await validateApiKey(request);

    if (!valid || !projectId) {
      return NextResponse.json({ error: error || "Invalid API key" }, { status: 401 });
    }

    const lang = request.nextUrl.searchParams.get("lang");
    const namespace = request.nextUrl.searchParams.get("namespace");

    // Build base conditions
    const conditions = [
      eq(translationKeys.projectId, projectId),
      eq(translations.state, "approved"),
    ];

    // Apply language filter if provided
    if (lang) {
      conditions.push(eq(languages.code, lang));
    }

    // Build query
    const results = await db
      .select({
        key: translationKeys.key,
        value: translations.value,
        language: languages.code,
        namespace: translationKeys.namespace,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(languages, eq(translations.languageId, languages.id))
      .where(and(...conditions));

    // Format response
    const response: Record<string, Record<string, string>> = {};

    for (const row of results) {
      const ns = row.namespace || "default";
      if (!response[ns]) {
        response[ns] = {};
      }
      response[ns][row.key] = row.value;
    }

    // If language filter is applied, return flat object
    if (lang) {
      const flatResponse: Record<string, string> = {};
      for (const row of results) {
        flatResponse[row.key] = row.value;
      }
      return NextResponse.json(flatResponse);
    }

    // If namespace filter is applied
    if (namespace) {
      return NextResponse.json(response[namespace] || {});
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching translations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

