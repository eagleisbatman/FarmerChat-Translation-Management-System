import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchHistory } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { formatErrorResponse, AuthenticationError, ValidationError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

/**
 * GET /api/search-history?projectId=xxx&limit=20
 * Get recent search history for a project
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20");

    if (!projectId) {
      return NextResponse.json(formatErrorResponse(new ValidationError("projectId is required")), { status: 400 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, projectId);

    const history = await db
      .select()
      .from(searchHistory)
      .where(
        and(
          eq(searchHistory.userId, session.user.id),
          eq(searchHistory.projectId, projectId)
        )
      )
      .orderBy(desc(searchHistory.createdAt))
      .limit(limit);

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching search history:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

/**
 * POST /api/search-history
 * Record a search in history
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(formatErrorResponse(new AuthenticationError()), { status: 401 });
    }

    const body = await request.json();
    const { projectId, query, filters, resultCount } = body;

    if (!projectId || !query) {
      return NextResponse.json(formatErrorResponse(new ValidationError("projectId and query are required")), { status: 400 });
    }

    // Verify user has access to project's organization
    await verifyProjectAccess(session.user.id, projectId);

    // Check if same search exists recently (within last hour) to avoid duplicates
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [recent] = await db
      .select()
      .from(searchHistory)
      .where(
        and(
          eq(searchHistory.userId, session.user.id),
          eq(searchHistory.projectId, projectId),
          eq(searchHistory.query, query)
        )
      )
      .orderBy(desc(searchHistory.createdAt))
      .limit(1);

    if (recent && recent.createdAt > oneHourAgo) {
      // Update existing entry instead of creating duplicate
      const [updated] = await db
        .update(searchHistory)
        .set({
          resultCount: resultCount || recent.resultCount,
          createdAt: new Date(), // Update timestamp to make it most recent
        })
        .where(eq(searchHistory.id, recent.id))
        .returning();

      return NextResponse.json(updated);
    }

    // Create new history entry
    const [newEntry] = await db
      .insert(searchHistory)
      .values({
        id: nanoid(),
        userId: session.user.id,
        projectId,
        query,
        filters: filters ? JSON.stringify(filters) : null,
        resultCount: resultCount || 0,
        createdAt: new Date(),
      })
      .returning();

    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error("Error recording search history:", error);
    return NextResponse.json(formatErrorResponse(error), { status: 500 });
  }
}

