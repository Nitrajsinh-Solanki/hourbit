// middleware.ts
// Edge runtime — cannot use jsonwebtoken (Node.js only)
// Must use jose which is Web Crypto API compatible

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify }                 from "jose";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard these two route trees
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  if (!isProtectedPage) return NextResponse.next();

  const token = req.cookies.get("token")?.value;

  // No token → redirect to login
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  try {
    // jose uses a Uint8Array secret — Edge compatible, no Node.js required
    const secret  = new TextEncoder().encode(process.env.JWT_SECRET!);
    const { payload } = await jwtVerify(token, secret);

    const role = payload.role as string | undefined;

    // Non-admin trying to reach /admin → send to dashboard
    if (pathname.startsWith("/admin") && role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Valid token, correct role → allow through
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