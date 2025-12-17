import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, NotFoundError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

// Define filter schema for type safety
const searchFilterSchema = z.record(
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(z.number()),
  ])
);

const createSavedSearchSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(255),
  query: z.string().min(1),
  filters: searchFilterSchema.optional(),
});

const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  query: z.string().min(1).optional(),
  filters: searchFilterSchema.optional(),
});

/**
 * GET /api/saved-searches?projectId=xxx
 * Get all saved searches for a project
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(formatErrorResponse(new ValidationError("projectId is required")), { status: 400 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, projectId);

    const searches = await db
      .select()
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.userId, session.user.id),
          eq(savedSearches.projectId, projectId)
        )
      )
      .orderBy(savedSearches.updatedAt);

    return NextResponse.json(searches);
  } catch (error) {
    console.error("Error fetching saved searches:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * POST /api/saved-searches
 * Create a new saved search
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const body = await request.json();
    const data = createSavedSearchSchema.parse(body);

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, data.projectId);

    const [newSearch] = await db
      .insert(savedSearches)
      .values({
        id: nanoid(),
        userId: session.user.id,
        projectId: data.projectId,
        name: data.name,
        query: data.query,
        filters: data.filters ? JSON.stringify(data.filters) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json(newSearch, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error creating saved search:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

