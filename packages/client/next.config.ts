import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN access (needed for campus network)
  allowedDevOrigins: ['http://10.7.48.61:3000', 'http://10.7.48.42:3000'],

  // Turbopack is default in Next.js 16 — empty config silences the webpack warning
  turbopack: {},
};

export default nextConfig;
