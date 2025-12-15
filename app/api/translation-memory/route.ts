import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { TranslationMemoryService } from "@/lib/translation-memory";
import { z } from "zod";

const findSimilarSchema = z.object({
  sourceText: z.string().min(1),
  sourceLanguageId: z.string(),
  targetLanguageId: z.string(),
  projectId: z.string(),
  threshold: z.number().min(0).max(1).optional().default(0.7),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = findSimilarSchema.parse(body);

    const memoryService = new TranslationMemoryService();
    const matches = await memoryService.findSimilar(
      data.sourceText,
      data.sourceLanguageId,
      data.targetLanguageId,
      data.projectId,
      data.threshold
    );

    return NextResponse.json({ matches });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error finding translation memory:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

