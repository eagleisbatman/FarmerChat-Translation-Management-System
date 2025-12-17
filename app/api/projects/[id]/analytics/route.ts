import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, translations, translationKeys, languages, users, translationHistory } from "@/lib/db/schema";
import { eq, and, sql, count, desc, gte, lte } from "drizzle-orm";
import { formatErrorResponse, AuthenticationError, NotFoundError } from "@/lib/errors";
import { verifyProjectAccess } from "@/lib/security/organization-access";

/**
 * Get analytics data for a project
 * Supports date range filtering via query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session) {
      throw new AuthenticationError();
    }

    // Verify user has access to project's organization
    const { project } = await verifyProjectAccess(session.user.id, id);

    // Parse date range from query params
    const fromDate = request.nextUrl.searchParams.get("from");
    const toDate = request.nextUrl.searchParams.get("to");
    const dateRange = fromDate && toDate ? `${fromDate}_${toDate}` : undefined;
    
    // Check cache first
    const { Cache, CacheKeys, CacheTTL } = await import("@/lib/cache");
    const cache = new Cache();
    const cacheKey = CacheKeys.analytics(id, dateRange);
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const dateFilter = [];
    
    if (fromDate) {
      dateFilter.push(gte(translations.createdAt, new Date(fromDate)));
    }
    if (toDate) {
      dateFilter.push(lte(translations.createdAt, new Date(toDate)));
    }

    // 1. Translation completion rates per language
    const translationStats = await db
      .select({
        languageCode: languages.code,
        languageName: languages.name,
        total: count(translations.id),
        approved: sql<number>`COUNT(CASE WHEN ${translations.state} = 'approved' THEN 1 END)`,
        inReview: sql<number>`COUNT(CASE WHEN ${translations.state} = 'review' THEN 1 END)`,
        draft: sql<number>`COUNT(CASE WHEN ${translations.state} = 'draft' THEN 1 END)`,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(languages, eq(translations.languageId, languages.id))
      .where(
        and(
          eq(translationKeys.projectId, id),
          ...dateFilter
        )
      )
      .groupBy(languages.id, languages.code, languages.name)
      .orderBy(desc(count(translations.id)));

    // 2. Total keys and translations count
    const [keyStats] = await db
      .select({
        totalKeys: count(translationKeys.id),
        totalTranslations: count(translations.id),
        approvedTranslations: sql<number>`COUNT(CASE WHEN ${translations.state} = 'approved' THEN 1 END)`,
      })
      .from(translationKeys)
      .leftJoin(translations, eq(translations.keyId, translationKeys.id))
      .where(eq(translationKeys.projectId, id));

    // 3. User contribution metrics
    // Get users who have contributed to this project
    const userContributionsRaw = await db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        translationsCreated: sql<number>`COUNT(DISTINCT CASE WHEN ${translations.createdBy} = ${users.id} THEN ${translations.id} END)`,
        translationsApproved: sql<number>`COUNT(DISTINCT CASE WHEN ${translations.state} = 'approved' AND ${translations.createdBy} = ${users.id} THEN ${translations.id} END)`,
        reviewsCompleted: sql<number>`COUNT(DISTINCT CASE WHEN ${translations.reviewedBy} = ${users.id} THEN ${translations.id} END)`,
      })
      .from(users)
      .innerJoin(translations, eq(translations.createdBy, users.id))
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(
        and(
          eq(translationKeys.projectId, id),
          ...dateFilter
        )
      )
      .groupBy(users.id, users.name, users.email)
      .orderBy(desc(sql`COUNT(DISTINCT ${translations.id})`))
      .limit(10);
    
    const userContributions = userContributionsRaw.map((uc) => ({
      userId: uc.userId,
      userName: uc.userName,
      userEmail: uc.userEmail,
      translationsCreated: Number(uc.translationsCreated || 0),
      translationsApproved: Number(uc.translationsApproved || 0),
      reviewsCompleted: Number(uc.reviewsCompleted || 0),
    }));

    // 4. Translation activity over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activityOverTime = await db
      .select({
        date: sql<string>`DATE(${translations.createdAt})`,
        count: count(translations.id),
        approved: sql<number>`COUNT(CASE WHEN ${translations.state} = 'approved' THEN 1 END)`,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(
        and(
          eq(translationKeys.projectId, id),
          gte(translations.createdAt, thirtyDaysAgo),
          ...dateFilter
        )
      )
      .groupBy(sql`DATE(${translations.createdAt})`)
      .orderBy(sql`DATE(${translations.createdAt})`);

    // 5. Review turnaround time (average time from review to approved/rejected)
    const reviewTurnaround = await db
      .select({
        avgHours: sql<number>`AVG(EXTRACT(EPOCH FROM (${translations.updatedAt} - ${translations.createdAt})) / 3600)`,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .where(
        and(
          eq(translationKeys.projectId, id),
          eq(translations.state, "approved"),
          ...dateFilter
        )
      );

    // 6. Namespace distribution
    const namespaceStats = await db
      .select({
        namespace: translationKeys.namespace,
        count: count(translationKeys.id),
      })
      .from(translationKeys)
      .where(eq(translationKeys.projectId, id))
      .groupBy(translationKeys.namespace)
      .orderBy(desc(count(translationKeys.id)));

    const analyticsData = {
      project: {
        id: project.id,
        name: project.name,
      },
      summary: {
        totalKeys: Number(keyStats?.totalKeys || 0),
        totalTranslations: Number(keyStats?.totalTranslations || 0),
        approvedTranslations: Number(keyStats?.approvedTranslations || 0),
        completionRate: keyStats?.totalKeys 
          ? ((Number(keyStats.approvedTranslations) / Number(keyStats.totalKeys)) * 100).toFixed(1)
          : "0",
      },
      translationStats,
      userContributions,
      activityOverTime: activityOverTime.map((aot) => ({
        date: aot.date,
        count: Number(aot.count || 0),
        approved: Number(aot.approved || 0),
      })),
      reviewTurnaround: {
        avgHours: reviewTurnaround[0]?.avgHours 
          ? Number(reviewTurnaround[0].avgHours).toFixed(1)
          : null,
      },
      namespaceStats: namespaceStats.map((ns) => ({
        namespace: ns.namespace || "default",
        count: Number(ns.count || 0),
      })),
    };

    // Cache for 5 minutes (analytics can be slightly stale)
    await cache.set(cacheKey, analyticsData, CacheTTL.MEDIUM);

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error("Error fetching analytics:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

