import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-middleware";
import { rateLimit, getRateLimitIdentifier } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { translations, translationKeys, languages, projects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { formatErrorResponse } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 100 requests per minute per API key/IP
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = rateLimit(identifier, {
      maxRequests: 100,
      windowMs: 60 * 1000, // 1 minute
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many requests. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
            "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const { valid, projectId, error } = await validateApiKey(request);

    if (!valid || !projectId) {
      const errorResponse = formatErrorResponse(
        new Error(error || "Invalid API key")
      );
      return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
    }

    const lang = request.nextUrl.searchParams.get("lang");
    const namespace = request.nextUrl.searchParams.get("namespace");

    // Check cache first (only for approved translations, which are stable)
    const { Cache, CacheKeys, CacheTTL } = await import("@/lib/cache");
    const cache = new Cache();
    const cacheKey = CacheKeys.projectTranslations(projectId, lang || undefined);
    
    const cached = await cache.get<Record<string, Record<string, string>>>(cacheKey);
    if (cached) {
      // Apply namespace filter if needed
      if (namespace) {
        const filtered: Record<string, Record<string, string>> = {};
        if (cached[namespace]) {
          filtered[namespace] = cached[namespace];
        }
        return addRateLimitHeaders(NextResponse.json(filtered));
      }
      return addRateLimitHeaders(NextResponse.json(cached));
    }

    // Build base conditions
    const conditions = [
      eq(translationKeys.projectId, projectId),
      eq(translations.state, "approved"),
    ];

    // Apply language filter if provided
    let targetLanguageId: string | undefined;
    if (lang) {
      const [targetLang] = await db
        .select()
        .from(languages)
        .where(eq(languages.code, lang))
        .limit(1);
      
      if (targetLang) {
        conditions.push(eq(translations.languageId, targetLang.id));
        targetLanguageId = targetLang.id;
      }
    }

    // Build query
    const results = await db
      .select({
        key: translationKeys.key,
        value: translations.value,
        language: languages.code,
        namespace: translationKeys.namespace,
      })
      .from(translations)
      .innerJoin(translationKeys, eq(translations.keyId, translationKeys.id))
      .innerJoin(languages, eq(translations.languageId, languages.id))
      .where(and(...conditions));

    // Format response data
    const responseData: Record<string, Record<string, string>> = {};

    for (const row of results) {
      const ns = row.namespace || "default";
      if (!responseData[ns]) {
        responseData[ns] = {};
      }
      responseData[ns][row.key] = row.value;
    }

    // Cache for 1 hour (approved translations are stable)
    await cache.set(cacheKey, responseData, CacheTTL.LONG);

    // Helper to add rate limit headers
    const addRateLimitHeaders = (res: NextResponse) => {
      res.headers.set("X-RateLimit-Limit", "100");
      res.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
      res.headers.set("X-RateLimit-Reset", new Date(rateLimitResult.resetTime).toISOString());
      return res;
    };

    // If language filter is applied, return flat object
    if (lang) {
      const flatResponse: Record<string, string> = {};
      for (const row of results) {
        flatResponse[row.key] = row.value;
      }
      return addRateLimitHeaders(NextResponse.json(flatResponse));
    }

    // If namespace filter is applied
    if (namespace) {
      return addRateLimitHeaders(NextResponse.json(responseData[namespace] || {}));
    }

    return addRateLimitHeaders(NextResponse.json(responseData));
  } catch (error) {
    console.error("Error fetching translations:", error);
    const errorResponse = formatErrorResponse(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}

