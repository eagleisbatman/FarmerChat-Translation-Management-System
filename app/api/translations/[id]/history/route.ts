import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationHistory, translations, users, translationKeys } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Get translation with key to verify project access
    const [translationData] = await db
      .select({
        translation: translations,
        key: translationKeys,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(eq(translations.id, id))
      .limit(1);

    if (!translationData) {
      return NextResponse.json(formatErrorResponse(new Error("Translation not found")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, translationData.key.projectId);

    // Get history
    const history = await db
      .select({
        history: translationHistory,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(translationHistory)
      .innerJoin(users, eq(translationHistory.changedBy, users.id))
      .where(eq(translationHistory.translationId, id))
      .orderBy(desc(translationHistory.createdAt));

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching translation history:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

