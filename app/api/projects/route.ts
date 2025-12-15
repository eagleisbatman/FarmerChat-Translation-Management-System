import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  defaultLanguageId: z.string().optional(),
  requiresReview: z.boolean().default(true),
  aiProvider: z.enum(["openai", "gemini", "google-translate"]).optional(),
  aiFallbackProvider: z.enum(["openai", "gemini", "google-translate"]).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allProjects = await db.select().from(projects);

    return NextResponse.json(allProjects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const data = createProjectSchema.parse(body);

    // Generate API key
    const apiKey = `tms_${nanoid(32)}`;
    const apiKeyHash = await bcrypt.hash(apiKey, 10);

    const projectId = nanoid();

    const [newProject] = await db
      .insert(projects)
      .values({
        id: projectId,
        name: data.name,
        description: data.description,
        defaultLanguageId: data.defaultLanguageId,
        requiresReview: data.requiresReview,
        aiProvider: data.aiProvider || null,
        aiFallbackProvider: data.aiFallbackProvider || null,
        apiKey: apiKey,
        apiKeyHash: apiKeyHash,
      })
      .returning();

    return NextResponse.json({ ...newProject, apiKey }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

