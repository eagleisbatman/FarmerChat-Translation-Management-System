import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keyScreenshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getStorageAdapter } from "@/lib/storage";

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

    // Get screenshot to check ownership or admin
    const [screenshot] = await db
      .select()
      .from(keyScreenshots)
      .where(eq(keyScreenshots.id, id))
      .limit(1);

    if (!screenshot) {
      return NextResponse.json({ error: "Screenshot not found" }, { status: 404 });
    }

    // Only allow deletion by uploader or admin
    if (screenshot.uploadedBy !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

