import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Replace any client-supplied method. Session guards use this only as an additional deny gate.
  headers.set("x-mm-method", request.method);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"] };
