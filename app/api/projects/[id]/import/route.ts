import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translationKeys, translations, languages, projectLanguages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "translator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const text = await file.text();
    let data: Record<string, Record<string, string>> | Record<string, string>;

    // Parse JSON
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
    }

    // Get default language
    const [defaultLang] = await db
      .select()
      .from(languages)
      .where(eq(languages.id, project.defaultLanguageId || "en"))
      .limit(1);

    if (!defaultLang) {
      return NextResponse.json({ error: "Default language not found" }, { status: 400 });
    }

    const createdKeys: string[] = [];
    const createdTranslations: string[] = [];

    // Handle nested structure (namespaces)
    if (typeof data === "object" && !Array.isArray(data)) {
      for (const [namespace, translations] of Object.entries(data)) {
        if (typeof translations === "object" && translations !== null) {
          for (const [key, value] of Object.entries(translations)) {
            if (typeof value === "string") {
              // Create or get translation key
              const existingKeys = await db
                .select()
                .from(translationKeys)
                .where(eq(translationKeys.projectId, id));
              
              const existingKey = existingKeys.find((k) => k.key === key);

              let keyId: string;
              if (existingKey) {
                keyId = existingKey.id;
              } else {
                const [newKey] = await db
                  .insert(translationKeys)
                  .values({
                    id: nanoid(),
                    projectId: id,
                    key,
                    namespace: namespace === "default" ? null : namespace,
                  })
                  .returning();
                keyId = newKey.id;
                createdKeys.push(key);
              }

              // Create translation
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
                  value,
                  state: project.requiresReview ? "draft" : "approved",
                  createdBy: session.user.id,
                });
                createdTranslations.push(key);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      keysCreated: createdKeys.length,
      translationsCreated: createdTranslations.length,
    });
  } catch (error) {
    console.error("Error importing translations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

