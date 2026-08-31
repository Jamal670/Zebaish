import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
  reactStrictMode: true,
  cleanDistDir: true,
};

export default nextConfig;
