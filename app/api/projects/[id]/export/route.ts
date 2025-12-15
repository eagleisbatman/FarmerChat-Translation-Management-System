import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages, projectLanguages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    console.error("Error exporting translations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

