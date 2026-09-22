import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies Django MEDIA through Next so <img> works on Netlify + localtunnel.
 * Browser image requests cannot set Bypass-Tunnel-Reminder; this route can.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!path?.length) {
    return new NextResponse("Missing path", { status: 400 });
  }

  const origin = (
    process.env.DJANGO_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "");

  const mediaPath = path.map(encodeURIComponent).join("/");
  const upstream = `${origin}/media/${mediaPath}`;

  try {
    const res = await fetch(upstream, {
      headers: {
        "Bypass-Tunnel-Reminder": "true",
        "User-Agent": "PlotlineMediaProxy/1.0",
      },
      // Screenshots are stable per filename
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return new NextResponse(`Upstream ${res.status}`, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Media proxy failed", { status: 502 });
  }
}
