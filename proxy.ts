// proxy.ts  (root level, next to package.json)
// Next.js 16: file is proxy.ts and the exported function must be named "proxy"
// Edge runtime — uses jose (Web Crypto API), NOT jsonwebtoken (Node.js only)

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify }                 from "jose";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard dashboard and admin page routes
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  if (!isProtectedPage) return NextResponse.next();

  const token = req.cookies.get("token")?.value;

  // No token → redirect to login immediately
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  try {
    // jose uses Web Crypto API — Edge compatible
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    const role = payload.role as string | undefined;

    // Non-admin trying to reach /admin → redirect to dashboard
    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Token valid, role correct → allow through
    return NextResponse.next();

  } catch {
    // Token invalid or expired → clear cookie and redirect to login
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    const response = NextResponse.redirect(url);
    response.cookies.set("token", "", {
      httpOnly: true,
      secure:   true,
      sameSite: "strict",
      maxAge:   0,
      path:     "/",
    });
    return response;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};