import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { TranslationMemoryService } from "@/lib/translation-memory";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

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
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const body = await request.json();
    const data = findSimilarSchema.parse(body);

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, data.projectId);

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
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error finding translation memory:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

