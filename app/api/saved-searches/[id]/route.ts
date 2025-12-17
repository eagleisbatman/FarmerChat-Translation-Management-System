import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { savedSearches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { formatErrorResponse, AuthenticationError, ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";

const updateSavedSearchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  query: z.string().min(1).optional(),
  filters: z.record(z.any()).optional(),
});

/**
 * GET /api/saved-searches/[id]
 * Get a specific saved search
 */
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

    const [search] = await db
      .select()
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.id, id),
          eq(savedSearches.userId, session.user.id)
        )
      )
      .limit(1);

    if (!search) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Saved search")), { status: 404 });
    }

    return NextResponse.json(search);
  } catch (error) {
    console.error("Error fetching saved search:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * PATCH /api/saved-searches/[id]
 * Update a saved search
 */
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

    const body = await request.json();
    const data = updateSavedSearchSchema.parse(body);

    // Verify ownership
    const [existing] = await db
      .select()
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.id, id),
          eq(savedSearches.userId, session.user.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Saved search")), { status: 404 });
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.query !== undefined) {
      updateData.query = data.query;
    }
    if (data.filters !== undefined) {
      updateData.filters = JSON.stringify(data.filters);
    }

    const [updated] = await db
      .update(savedSearches)
      .set(updateData)
      .where(eq(savedSearches.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(formatErrorResponse(new ValidationError(error.errors[0].message)), { status: 400 });
    }
    console.error("Error updating saved search:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * DELETE /api/saved-searches/[id]
 * Delete a saved search
 */
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

    // Verify ownership
    const [existing] = await db
      .select()
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.id, id),
          eq(savedSearches.userId, session.user.id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(formatErrorResponse(new NotFoundError("Saved search")), { status: 404 });
    }

    await db
      .delete(savedSearches)
      .where(eq(savedSearches.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved search:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

