import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config: { module: { rules: { test: RegExp; issuer: RegExp; use: string[]; }[]; }; }) {
    config.module.rules.push({
      test: /\.svg$/,
      issuer: /\.[jt]sx?$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
};

module.exports = nextConfig;
