import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dockerfile.frontend runs the minimal production server generated here.
  // Without this option, `.next/standalone` is not created.
  output: "standalone",
  productionBrowserSourceMaps: false,
};

export default nextConfig;
