import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Set this only when every public request is routed through the Anubis gateway.
export function proxy(request: NextRequest) {
  const expected = process.env.ANUBIS_ORIGIN_SECRET;
  if (!expected) return NextResponse.next();

  const received = request.headers.get("x-anubis-origin-secret") ?? "";
  const actualBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  if (
    actualBytes.length !== expectedBytes.length ||
    !timingSafeEqual(actualBytes, expectedBytes)
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

export const config = { matcher: "/:path*" };
