/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: "dist",
  // Force all pages to be client-side only
  experimental: {},
};

module.exports = nextConfig;
