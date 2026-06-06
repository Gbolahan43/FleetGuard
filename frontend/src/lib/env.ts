/** Path A — API Gateway (Live Monitor). Empty → mock data in dev. */
export function getApiUrl(): string | undefined {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  return url ? url.replace(/\/$/, "") : undefined;
}

/** Path B — App Runner / local FastAPI (Analyze Logs). */
export function getBatchApiUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_BATCH_API_URL?.trim() ||
    "http://127.0.0.1:8080";
  return url.replace(/\/$/, "");
}
