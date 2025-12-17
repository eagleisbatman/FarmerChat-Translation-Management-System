import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  requiresReview: z.boolean().optional(),
  aiProvider: z.enum(["openai", "gemini", "google-translate"]).nullable().optional(),
  aiFallbackProvider: z.enum(["openai", "gemini", "google-translate"]).nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Verify user has admin access to project's organization
    const { project, access } = await verifyProjectAccess(session.user.id, id, true);

    const body = await request.json();
    const data = updateProjectSchema.parse(body);

    const [updated] = await db
      .update(projects)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(formatErrorResponse(new Error("Project not found")), { status: 404 });
    }

    // Invalidate cache
    const { invalidateProjectCache } = await import("@/lib/cache/invalidation");
    await invalidateProjectCache(id);

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error updating project:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
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
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    // Check cache first
    const { Cache, CacheKeys, CacheTTL } = await import("@/lib/cache");
    const cache = new Cache();
    const cacheKey = CacheKeys.project(id);
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Verify user has access to project's organization
    const { project } = await verifyProjectAccess(session.user.id, id);

    // Cache for 5 minutes
    await cache.set(cacheKey, project, CacheTTL.MEDIUM);

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

