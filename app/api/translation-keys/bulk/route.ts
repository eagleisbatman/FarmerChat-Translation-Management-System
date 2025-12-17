import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationKeys, translations } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, ForbiddenError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const bulkActionSchema = z.object({
  projectId: z.string(),
  keyIds: z.array(z.string()).min(1),
  action: z.enum(["approve", "reject", "delete"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const body = await request.json();
    const data = bulkActionSchema.parse(body);

    // Verify user has admin access to project's organization
    await verifyProjectAccess(session.user.id, data.projectId, true);

    if (session.user.role !== "admin" && session.user.role !== "reviewer") {
      return NextResponse.json(formatErrorResponse(new ForbiddenError("Only admins and reviewers can perform bulk actions")), { status: 403 });
    }

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
        formatErrorResponse(new ValidationError("Some keys not found or don't belong to this project")),
        { status: 400 }
      );
    }

    if (data.action === "delete") {
      if (session.user.role !== "admin") {
        return NextResponse.json(formatErrorResponse(new ForbiddenError("Only admins can delete keys")), { status: 403 });
      }

      // Delete translations first (cascade should handle this, but being explicit)
      await db.delete(translations).where(inArray(translations.keyId, data.keyIds));

      // Delete the keys
      await db.delete(translationKeys).where(inArray(translationKeys.id, data.keyIds));

      return NextResponse.json({ success: true, deleted: data.keyIds.length });
    }

    if (data.action === "approve" || data.action === "reject") {
      if (session.user.role !== "admin" && session.user.role !== "reviewer") {
        return NextResponse.json(formatErrorResponse(new ForbiddenError("Only admins and reviewers can approve or reject translations")), { status: 403 });
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

    return NextResponse.json(formatErrorResponse(new ValidationError("Invalid action")), { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error performing bulk action:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

