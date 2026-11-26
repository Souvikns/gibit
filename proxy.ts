import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, shouldRenew, signSession, verifySession } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const password = process.env.ADMIN_PASSWORD;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = password && token ? await verifySession(password, token) : { valid: false as const };

  if (!session.valid) {
    if (pathname === "/login") return NextResponse.next();
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login") return NextResponse.redirect(new URL("/", request.url));

  const response = NextResponse.next();
  if (password && shouldRenew(session.expiresAt)) {
    response.cookies.set(SESSION_COOKIE, await signSession(password, Date.now() + SESSION_MAX_AGE_S * 1000), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_S,
    });
  }
  return response;
}

export const config = {
  // /api/mcp does its own bearer auth (Plan 2).
  matcher: ["/((?!api/mcp|_next/static|_next/image|favicon.ico).*)"],
};
