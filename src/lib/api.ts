/**
 * Generates the full API URL for worker HTTP requests,
 * ensuring clean URL formatting and direct CORS communication with the worker.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // 1. Fallback to local worker dev server if running in local browser
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const isLocal =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    if (isLocal) {
      if (
        process.env.NEXT_PUBLIC_WORKER_URL &&
        (process.env.NEXT_PUBLIC_WORKER_URL.includes("localhost") ||
          process.env.NEXT_PUBLIC_WORKER_URL.includes("127.0.0.1"))
      ) {
        const base = process.env.NEXT_PUBLIC_WORKER_URL.trim()
          .replace(/['"]+/g, "")
          .replace(/localhost/g, "127.0.0.1")
          .replace(/\/+$/, "");
        return `${base}${cleanPath}`;
      }
      const resolvedHost = hostname === "localhost" ? "127.0.0.1" : hostname;
      return `http://${resolvedHost}:8787${cleanPath}`;
    }
  }

  // 2. Explicit configured URL
  if (process.env.NEXT_PUBLIC_WORKER_URL) {
    const base = process.env.NEXT_PUBLIC_WORKER_URL.trim()
      .replace(/['"]+/g, "")
      .replace(/localhost/g, "127.0.0.1")
      .replace(/\/+$/, "");
    return `${base}${cleanPath}`;
  }

  return cleanPath;
}
