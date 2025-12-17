/**
 * Rate limiting middleware for API routes
 * Provides consistent rate limiting across all API endpoints
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getRateLimitIdentifier, RateLimitOptions } from "@/lib/rate-limit";
import { formatErrorResponse, RateLimitError } from "@/lib/errors";

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  skipSuccessfulRequests: false,
};

/**
 * Rate limiting middleware wrapper
 * Use this to wrap API route handlers with rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig = DEFAULT_CONFIG
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = rateLimit(identifier, {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        formatErrorResponse(
          new RateLimitError(
            `Rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 1000} seconds.`
          )
        ),
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": config.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
            "Retry-After": Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Execute handler
    const response = await handler(request);

    // Add rate limit headers to responses
    // If skipSuccessfulRequests is enabled, only add headers to error responses (status >= 400)
    // Otherwise, add headers to all responses
    if (!config.skipSuccessfulRequests || response.status >= 400) {
      response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
      response.headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
      response.headers.set("X-RateLimit-Reset", new Date(rateLimitResult.resetTime).toISOString());
    }

    return response;
  };
}

/**
 * Rate limit configurations for different route types
 */
export const RATE_LIMIT_CONFIGS = {
  // Public API routes (more restrictive)
  public: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
  },
  // Authenticated routes (moderate)
  authenticated: {
    maxRequests: 200,
    windowMs: 60 * 1000, // 1 minute
  },
  // Bulk operations (more restrictive)
  bulk: {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
  },
  // File uploads (very restrictive)
  upload: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
} as const;

