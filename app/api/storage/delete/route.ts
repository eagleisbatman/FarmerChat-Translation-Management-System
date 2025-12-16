import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getStorageAdapter } from "@/lib/storage";
import { z } from "zod";

const deleteSchema = z.object({
  key: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = deleteSchema.parse(body);

    const storage = getStorageAdapter();
    await storage.delete(data.key);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}

