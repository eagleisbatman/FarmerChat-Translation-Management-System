import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOrganizationContext } from "@/lib/organizations/context";

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // Allow public access to auth pages
  if (pathname.startsWith("/signin") || pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (
    pathname.startsWith("/projects") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/organizations")
  ) {
    if (!req.auth) {
      return NextResponse.redirect(new URL("/signin", req.url));
    }

    // Extract organization context from URL
    // This helps pages/components know which organization they're working with
    if (req.auth.user?.id) {
      try {
        // Extract project ID from URL if present
        const projectMatch = pathname.match(/^\/projects\/([^\/]+)/);
        const projectId = projectMatch ? projectMatch[1] : undefined;

        const orgContext = await getOrganizationContext(
          req.auth.user.id,
          pathname,
          projectId
        );

        if (orgContext) {
          // Add organization context to request headers for downstream use
          const response = NextResponse.next();
          response.headers.set("x-organization-id", orgContext.organizationId);
          response.headers.set("x-organization-role", orgContext.role);
          return response;
        }
      } catch (error) {
        // Don't fail the request if org context lookup fails
        console.error("Error getting organization context:", error);
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

