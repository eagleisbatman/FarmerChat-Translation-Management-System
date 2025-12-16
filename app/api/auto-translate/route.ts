import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AutoTranslateService } from "@/lib/auto-translate";
import { db } from "@/lib/db";
import { projects, languages, keyScreenshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { formatErrorResponse, ValidationError, NotFoundError, ExternalServiceError } from "@/lib/errors";

const translateSchema = z.object({
  projectId: z.string(),
  text: z.string().min(1),
  sourceLanguageId: z.string(),
  targetLanguageId: z.string(),
  imageUrl: z.string().url().optional(),
  imageBase64: z.string().optional(),
  context: z.string().optional(),
  keyId: z.string().optional(), // Optional: to fetch associated screenshots
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
      throw new NotFoundError("Project");
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
      throw new NotFoundError("Language");
    }

    // Fetch associated screenshots if keyId is provided
    let imageUrl = data.imageUrl;
    if (!imageUrl && data.keyId) {
      const screenshots = await db
        .select()
        .from(keyScreenshots)
        .where(eq(keyScreenshots.keyId, data.keyId))
        .limit(1);
      
      if (screenshots.length > 0) {
        imageUrl = screenshots[0].imageUrl;
      }
    }

    // Translate using auto-translate service with image context
    const autoTranslate = new AutoTranslateService();
    const result = await autoTranslate.translate(
      {
        text: data.text,
        sourceLanguage: sourceLang.code,
        targetLanguage: targetLang.code,
        imageUrl: imageUrl,
        imageBase64: data.imageBase64,
        context: data.context || (data.keyId ? `Translation key: ${data.keyId}` : undefined),
      },
      project.aiProvider || undefined,
      project.aiFallbackProvider || undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        "Invalid request data",
        "Please check that all required fields are provided correctly."
      );
    }
    console.error("Error translating:", error);
    
    // Check if it's an external service error
    if (error instanceof Error && (
      error.message.includes("OpenAI") ||
      error.message.includes("Gemini") ||
      error.message.includes("Google Translate")
    )) {
      const serviceName = error.message.includes("OpenAI") ? "OpenAI" :
                         error.message.includes("Gemini") ? "Gemini" : "Google Translate";
      throw new ExternalServiceError(
        serviceName,
        error.message,
        `The ${serviceName} translation service encountered an error. Please check your API key and try again.`
      );
    }
    
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
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

