import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projectLanguages, projects, languages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const addLanguageSchema = z.object({
  languageId: z.string(),
  isDefault: z.boolean().default(false),
});

export async function POST(
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

    const body = await request.json();
    const data = addLanguageSchema.parse(body);

    // Verify project exists
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify language exists
    const [language] = await db
      .select()
      .from(languages)
      .where(eq(languages.id, data.languageId))
      .limit(1);

    if (!language) {
      return NextResponse.json({ error: "Language not found" }, { status: 404 });
    }

    // Check if already added
    const [existing] = await db
      .select()
      .from(projectLanguages)
      .where(
        and(
          eq(projectLanguages.projectId, id),
          eq(projectLanguages.languageId, data.languageId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "Language already added to project" },
        { status: 409 }
      );
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db
        .update(projectLanguages)
        .set({ isDefault: false })
        .where(eq(projectLanguages.projectId, id));
    }

    const [newProjectLanguage] = await db
      .insert(projectLanguages)
      .values({
        projectId: id,
        languageId: data.languageId,
        isDefault: data.isDefault,
      })
      .returning();

    return NextResponse.json(newProjectLanguage, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error adding language to project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const projectLangs = await db
      .select({
        projectLanguage: projectLanguages,
        language: languages,
      })
      .from(projectLanguages)
      .innerJoin(languages, eq(projectLanguages.languageId, languages.id))
      .where(eq(projectLanguages.projectId, id));

    return NextResponse.json(projectLangs);
  } catch (error) {
    console.error("Error fetching project languages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    const languageId = request.nextUrl.searchParams.get("languageId");

    if (!languageId) {
      return NextResponse.json({ error: "languageId is required" }, { status: 400 });
    }

    await db
      .delete(projectLanguages)
      .where(
        and(
          eq(projectLanguages.projectId, id),
          eq(projectLanguages.languageId, languageId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing language from project:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

