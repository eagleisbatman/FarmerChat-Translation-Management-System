import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AutoTranslateService } from "@/lib/auto-translate";
import { db } from "@/lib/db";
import { projects, languages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const translateSchema = z.object({
  projectId: z.string(),
  text: z.string().min(1),
  sourceLanguageId: z.string(),
  targetLanguageId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = translateSchema.parse(body);

    // Get project to check AI provider settings
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, data.projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Get language codes
    const [sourceLang] = await db
      .select()
      .from(languages)
      .where(eq(languages.id, data.sourceLanguageId))
      .limit(1);

    const [targetLang] = await db
      .select()
      .from(languages)
      .where(eq(languages.id, data.targetLanguageId))
      .limit(1);

    if (!sourceLang || !targetLang) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 });
    }

    // Translate using auto-translate service
    const autoTranslate = new AutoTranslateService();
    const result = await autoTranslate.translate(
      {
        text: data.text,
        sourceLanguage: sourceLang.code,
        targetLanguage: targetLang.code,
      },
      project.aiProvider || undefined,
      project.aiFallbackProvider || undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error translating:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const autoTranslate = new AutoTranslateService();
    const availableProviders = autoTranslate.getAvailableProviders();

    return NextResponse.json({ providers: availableProviders });
  } catch (error) {
    console.error("Error fetching providers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

