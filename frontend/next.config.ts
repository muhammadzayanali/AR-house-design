import type { NextConfig } from "next";

const djangoOrigin = process.env.DJANGO_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  devIndicators: false,
  skipTrailingSlashRedirect: true,
  transpilePackages: [
    "three",
    "@react-three/fiber",
    "@react-three/drei",
    "@react-three/xr",
  ],
  images: { unoptimized: true },
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.1.140",
    "192.168.2.100",
    "192.168.2.101",
    "192.168.2.103",
    "192.168.2.105",
  ],
  async rewrites() {
    // afterFiles runs before dynamic routes, so /api/media-proxy must not match
    // or the catch-all would forward it to Django /api instead of the proxy route.
    const api = "/api/:slug((?!media-proxy)[^/]+)";
    return [
      { source: `${api}/:rest*/`, destination: `${djangoOrigin}/api/:slug/:rest*/` },
      { source: `${api}/:rest*`, destination: `${djangoOrigin}/api/:slug/:rest*/` },
      { source: `${api}/`, destination: `${djangoOrigin}/api/:slug/` },
      { source: api, destination: `${djangoOrigin}/api/:slug/` },
      { source: "/media/:path*", destination: `${djangoOrigin}/media/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "xr-spatial-tracking=*, camera=*, microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
