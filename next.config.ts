import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://cars-rental-backend:8000/:path*",
      },
    ];
  },
};

export default nextConfig;