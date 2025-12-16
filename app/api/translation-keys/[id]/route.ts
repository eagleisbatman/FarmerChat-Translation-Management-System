import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationKeys, translations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify key exists
    const [key] = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.id, id))
      .limit(1);

    if (!key) {
      return NextResponse.json({ error: "Translation key not found" }, { status: 404 });
    }

    // Delete translations first (cascade should handle this, but being explicit)
    await db.delete(translations).where(eq(translations.keyId, id));

    // Delete the key
    await db.delete(translationKeys).where(eq(translationKeys.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting translation key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

