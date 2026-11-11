import { NextRequest, NextResponse } from "next/server";

import { fetchMedia } from "@/lib/mediaProxy";

function mediaSegments(pathname: string): string[] | null {
  const marker = "/api/media-proxy";
  const at = pathname.indexOf(marker);
  if (at === -1) return null;
  const tail = pathname.slice(at + marker.length).replace(/^\//, "");
  if (!tail) return [];
  return tail.split("/").map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
}

export async function proxy(request: NextRequest) {
  const rawPath = new URL(request.url).pathname;
  const segments = mediaSegments(rawPath) ?? mediaSegments(request.nextUrl.pathname);
  if (!segments) return NextResponse.next();

  const origin = (
    process.env.DJANGO_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  try {
    const result = await fetchMedia(origin, segments, (input, init) => fetch(input, init));
    if (!result.ok) return new NextResponse(result.message, { status: result.status });
    return new NextResponse(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Media proxy failed", { status: 502 });
  }
}

export const config = {
  matcher: ["/api/:path*"],
};
