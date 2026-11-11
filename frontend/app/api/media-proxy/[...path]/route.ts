import { NextRequest, NextResponse } from "next/server";

import { fetchMedia } from "@/lib/mediaProxy";

/**
 * Proxies Django MEDIA through Next so <img> can load screenshots.
 * The target must stay under /media/ on DJANGO_ORIGIN. Other paths and
 * redirects to other hosts are rejected.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const origin = (
    process.env.DJANGO_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  let result;
  try {
    result = await fetchMedia(origin, path ?? [], (input, init) => fetch(input, init));
  } catch {
    return new NextResponse("Media proxy failed", { status: 502 });
  }
  if (!result.ok) {
    return new NextResponse(result.message, { status: result.status });
  }
  return new NextResponse(result.body, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
