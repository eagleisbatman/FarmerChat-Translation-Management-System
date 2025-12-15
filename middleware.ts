import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public access to auth pages
  if (pathname.startsWith("/signin") || pathname.startsWith("/auth")) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/projects") || pathname.startsWith("/users") || pathname.startsWith("/settings")) {
    if (!req.auth) {
      return NextResponse.redirect(new URL("/signin", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

