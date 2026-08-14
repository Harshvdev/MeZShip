/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const rawWorkerUrl = (process.env.NEXT_PUBLIC_WORKER_URL || "http://127.0.0.1:8787").trim();
    const workerUrl = rawWorkerUrl.replace(/['"]+/g, "").replace(/\/+$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${workerUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;


