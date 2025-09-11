// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que el build falle por ESLint en Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack(config) {
    // Soporte para importar SVGs como React components: import Logo from "./logo.svg"
    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    return config;
  },
};

export default nextConfig;
