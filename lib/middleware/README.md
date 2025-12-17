# API Middleware

This directory contains reusable middleware for API routes.

## Rate Limiting Middleware

The rate limiting middleware provides consistent rate limiting across all API endpoints.

### Usage

Wrap your route handler with `withRateLimit`:

```typescript
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/middleware/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Your handler logic
  return NextResponse.json({ data: "..." });
}

// Wrap with rate limiting
export const GET = withRateLimit(
  async (request: NextRequest) => {
    // Your handler logic
    return NextResponse.json({ data: "..." });
  },
  RATE_LIMIT_CONFIGS.authenticated // or custom config
);
```

### Pre-configured Rate Limits

- `RATE_LIMIT_CONFIGS.public` - 100 requests/minute (for public API)
- `RATE_LIMIT_CONFIGS.authenticated` - 200 requests/minute (for authenticated routes)
- `RATE_LIMIT_CONFIGS.bulk` - 20 requests/minute (for bulk operations)
- `RATE_LIMIT_CONFIGS.upload` - 10 requests/minute (for file uploads)

### Custom Configuration

```typescript
export const POST = withRateLimit(
  async (request: NextRequest) => {
    // Your handler
  },
  {
    maxRequests: 50,
    windowMs: 60 * 1000, // 1 minute
    skipSuccessfulRequests: false,
  }
);
```

### Rate Limit Headers

The middleware automatically adds these headers to responses:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests in window
- `X-RateLimit-Reset` - When the rate limit resets (ISO timestamp)
- `Retry-After` - Seconds to wait before retrying (on 429)

### Migration Guide

To add rate limiting to existing routes:

1. Import the middleware:
```typescript
import { withRateLimit, RATE_LIMIT_CONFIGS } from "@/lib/middleware/rate-limit";
```

2. Wrap your handler:
```typescript
// Before
export async function GET(request: NextRequest) {
  // ...
}

// After
export const GET = withRateLimit(
  async (request: NextRequest) => {
    // ...
  },
  RATE_LIMIT_CONFIGS.authenticated
);
```

Note: The middleware preserves the original function signature, so it works seamlessly with Next.js route handlers.

