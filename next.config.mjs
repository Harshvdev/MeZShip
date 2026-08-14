/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || "http://127.0.0.1:8787";
    return [
      {
        source: "/api/:path*",
        destination: `${workerUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

