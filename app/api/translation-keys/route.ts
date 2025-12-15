import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { translationKeys, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const createKeySchema = z.object({
  projectId: z.string(),
  key: z.string().min(1).max(255),
  description: z.string().optional(),
  namespace: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "admin" && session.user.role !== "translator") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = createKeySchema.parse(body);

    // Verify project exists
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, data.projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if key already exists
    const existingKeys = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.projectId, data.projectId));
    
    const existing = existingKeys.find((k) => k.key === data.key);

    if (existing) {
      return NextResponse.json(
        { error: "Translation key already exists" },
        { status: 409 }
      );
    }

    const [newKey] = await db
      .insert(translationKeys)
      .values({
        id: nanoid(),
        projectId: data.projectId,
        key: data.key,
        description: data.description,
        namespace: data.namespace,
      })
      .returning();

    return NextResponse.json(newKey, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating translation key:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const keys = await db
      .select()
      .from(translationKeys)
      .where(eq(translationKeys.projectId, projectId));

    return NextResponse.json(keys);
  } catch (error) {
    console.error("Error fetching translation keys:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

