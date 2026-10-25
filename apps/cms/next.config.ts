import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@singalore/shared', '@singalore/ingest'],
  poweredByHeader: false,
  serverExternalPackages: ['music-metadata'],
  experimental: {
    serverActions: {
      bodySizeLimit: '52mb',
    },
  },
};

export default nextConfig;
