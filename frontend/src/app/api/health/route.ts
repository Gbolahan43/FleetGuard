import { NextResponse } from "next/server";
import { getBatchApiUrl } from "@/lib/env";

export async function GET() {
  const backend = getBatchApiUrl();
  try {
    const res = await fetch(`${backend}/healthz`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        model_loaded: false,
        backend,
        hint: "Start backend on port 8080 — see infrastructure/scripts/start_backend.cmd",
      },
      { status: 503 }
    );
  }
}
