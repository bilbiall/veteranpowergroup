import { NextResponse, type NextRequest } from "next/server";

const isStaffPath = (pathname: string) =>
  pathname === "/login" || pathname.startsWith("/dashboard") || pathname.startsWith("/api/documents") || pathname.startsWith("/api/exports");

export function proxy(request: NextRequest) {
  const surface = process.env.APP_SURFACE;
  const { pathname, search } = request.nextUrl;

  if (surface === "website" && isStaffPath(pathname)) {
    const destination = new URL(`${pathname}${search}`, process.env.STAFF_PORTAL_URL ?? "http://localhost:3001");
    return NextResponse.redirect(destination);
  }

  if (surface === "portal" && pathname === "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}
