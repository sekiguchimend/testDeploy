/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false, // Minify による問題を回避
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist", "pdf-parse"],
  },
};

module.exports = nextConfig;
