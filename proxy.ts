import { NextResponse, type NextRequest } from "next/server";
import { access } from "@/lib/auth/rbac";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Role-based gate for every page and API route (rules in lib/auth/rbac.ts). Signed out →
 * the login page (pages) or 401 (API); wrong role → the login page with a note offering to
 * switch account (pages) or 403 (API). Route handlers check again on the server.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const result = access(pathname, session?.role, request.method);
  if (result.ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return result.reason === "signed-out"
      ? NextResponse.json({ error: "Sign in first" }, { status: 401 })
      : NextResponse.json({ error: "Not allowed for your role" }, { status: 403 });
  }
  const url = new URL("/login", request.url);
  url.searchParams.set("next", pathname + search);
  if (result.reason === "forbidden") {
    url.searchParams.set("role", result.need[0]);
    url.searchParams.set("denied", "1");
  }
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets and static files.
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
