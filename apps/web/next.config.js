/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  transpilePackages: ['@virtual-window/astronomy-engine', 'three'],
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
