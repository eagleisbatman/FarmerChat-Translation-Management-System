import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationHistory, translations, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify translation exists
    const [translation] = await db
      .select()
      .from(translations)
      .where(eq(translations.id, id))
      .limit(1);

    if (!translation) {
      return NextResponse.json({ error: "Translation not found" }, { status: 404 });
    }

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

