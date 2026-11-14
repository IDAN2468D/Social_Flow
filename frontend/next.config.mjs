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
    const rawGateway =
      process.env.API_GATEWAY_URL ||
      (process.env.API_GATEWAY_HOSTPORT ? `http://${process.env.API_GATEWAY_HOSTPORT}` : '') ||
      (process.env.API_GATEWAY_HOST ? `https://${process.env.API_GATEWAY_HOST}` : '') ||
      'http://localhost:8088';
    const apiGateway =
      rawGateway.startsWith('http://') || rawGateway.startsWith('https://')
        ? rawGateway
        : `http://${rawGateway}`;
    return [
      {
        source: '/api/:path*',
        destination: `${apiGateway}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
