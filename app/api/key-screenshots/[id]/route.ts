import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keyScreenshots, translationKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStorageAdapter } from "@/lib/storage";
import { formatErrorResponse, AuthenticationError, NotFoundError, ForbiddenError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Get screenshot with key to verify project access
    const [screenshotData] = await db
      .select({
        screenshot: keyScreenshots,
        key: translationKeys,
      })
      .from(keyScreenshots)
      .innerJoin(translationKeys, eq(keyScreenshots.keyId, translationKeys.id))
      .where(eq(keyScreenshots.id, id))
      .limit(1);

    if (!screenshotData) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Screenshot")), { status: 404 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, screenshotData.key.projectId);

    const screenshot = screenshotData.screenshot;

    // Only allow deletion by uploader or admin
    if (screenshot.uploadedBy !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json(formatErrorResponse(new ForbiddenError("Only the uploader or an admin can delete this screenshot")), { status: 403 });
    }

    // Extract key from URL (handle both local and cloud URLs)
    const imageUrl = screenshot.imageUrl;
    let storageKey: string | null = null;

    if (imageUrl.startsWith("/uploads/")) {
      // Local storage
      storageKey = imageUrl.replace("/uploads/", "");
    } else if (imageUrl.includes("/")) {
      // Cloud storage - extract key from URL
      // Format: https://domain.com/path/to/file.jpg or https://bucket.domain.com/file.jpg
      const urlParts = imageUrl.split("/");
      storageKey = urlParts[urlParts.length - 1];
    }

    // Delete from database
    await db.delete(keyScreenshots).where(eq(keyScreenshots.id, id));

    // Delete from storage if key extracted
    if (storageKey) {
      try {
        const storage = getStorageAdapter();
        await storage.delete(storageKey);
      } catch (error) {
        // Log error but don't fail the request
        console.error("Failed to delete file from storage:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting screenshot:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

