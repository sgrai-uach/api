import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";

  // Manejo de preflight CORS (OPTIONS)
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-User-Id, X-Requested-With, *",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Id, X-Requested-With, *");

  return response;
}

export default proxy;

export const config = {
  matcher: ["/api/:path*", "/openapi.json"],
};
