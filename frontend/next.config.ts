import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", 
  images: {
    // 1. Allow SVGs
    dangerouslyAllowSVG: true,
    // 2. Set strict content security for SVGs to prevent scripts
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      // --- NEW: Allow images from ANY HTTPS domain (for AI search results) ---
      {
        protocol: "https",
        hostname: "**",
      },
      // --- NEW: Allow images from ANY HTTP domain ---
      {
        protocol: "http",
        hostname: "**",
      },
      // --- Existing Configurations ---
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "9000",
        pathname: "/aegra-media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/aegra-media/**",
      },
    ],
  },
};

export default nextConfig;