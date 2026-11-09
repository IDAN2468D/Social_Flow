/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    const apiGateway = process.env.API_GATEWAY_URL || 'http://localhost:8088';
    return [
      {
        source: '/api/:path*',
        destination: `${apiGateway}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
