import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { keyScreenshots } from "@/lib/db/schema";
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

    await db.delete(keyScreenshots).where(eq(keyScreenshots.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting screenshot:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

