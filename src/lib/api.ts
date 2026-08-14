/**
 * Generates the full API URL for worker HTTP requests,
 * ensuring clean URL formatting and direct CORS communication with the worker.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (process.env.NEXT_PUBLIC_WORKER_URL) {
    const base = process.env.NEXT_PUBLIC_WORKER_URL.trim()
      .replace(/['"]+/g, "")
      .replace(/\/+$/, "");
    return `${base}${cleanPath}`;
  }
  return cleanPath;
}
