import type { NextConfig } from "next";

const djangoOrigin = process.env.DJANGO_ORIGIN ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
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
    "192.168.2.103",
    "192.168.2.105",
  ],
  async rewrites() {
    return [
      { source: "/api/:path*/", destination: `${djangoOrigin}/api/:path*/` },
      { source: "/api/:path*", destination: `${djangoOrigin}/api/:path*/` },
      { source: "/media/:path*", destination: `${djangoOrigin}/media/:path*` },
    ];
  },
};

export default nextConfig;
