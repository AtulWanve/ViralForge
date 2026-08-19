import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Move the source dir mapping so Next.js finds app/ under src/frontend
  experimental: {
    // Next.js 14+ specific setting for customized src directory
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
