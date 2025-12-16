import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationKeys, translations } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const bulkActionSchema = z.object({
  projectId: z.string(),
  keyIds: z.array(z.string()).min(1),
  action: z.enum(["approve", "reject", "delete"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "reviewer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = bulkActionSchema.parse(body);

    // Verify all keys belong to the project
    const keys = await db
      .select()
      .from(translationKeys)
      .where(
        and(
          eq(translationKeys.projectId, data.projectId),
          inArray(translationKeys.id, data.keyIds)
        )
      );

    if (keys.length !== data.keyIds.length) {
      return NextResponse.json(
        { error: "Some keys not found or don't belong to this project" },
        { status: 400 }
      );
    }

    if (data.action === "delete") {
      if (session.user.role !== "admin") {
        return NextResponse.json({ error: "Only admins can delete keys" }, { status: 403 });
      }

      // Delete translations first (cascade should handle this, but being explicit)
      await db.delete(translations).where(inArray(translations.keyId, data.keyIds));

      // Delete the keys
      await db.delete(translationKeys).where(inArray(translationKeys.id, data.keyIds));

      return NextResponse.json({ success: true, deleted: data.keyIds.length });
    }

    if (data.action === "approve" || data.action === "reject") {
      if (session.user.role !== "admin" && session.user.role !== "reviewer") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const newState = data.action === "approve" ? "approved" : "draft";

      // Get all translations for these keys
      const allTranslations = await db
        .select()
        .from(translations)
        .where(inArray(translations.keyId, data.keyIds));

      // Update translations
      for (const translation of allTranslations) {
        await db
          .update(translations)
          .set({
            state: newState,
            reviewedBy: data.action === "approve" ? session.user.id : null,
            updatedAt: new Date(),
          })
          .where(eq(translations.id, translation.id));
      }

      return NextResponse.json({
        success: true,
        updated: allTranslations.length,
        keys: data.keyIds.length,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error performing bulk action:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

