import { getBatchApiUrl } from "@/lib/env";

export interface FleetSummary {
  total_rows: number;
  total_vehicles: number;
  anomaly_count: number;
  anomaly_rate_pct: number;
  breakdown: Record<string, number>;
}

export interface ScoredRow {
  vehicle_id: string;
  timestamp: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  fuel_level_pct: number;
  fuel_delta: number;
  is_anomaly: boolean;
  score: number;
  anomaly_type: string;
}

export interface AnomalyReport {
  vehicle_id: string;
  timestamp: string;
  lat: number;
  lng: number;
  score: number;
  anomaly_type: string;
  report: string;
}

export interface AnalyzeFleetResponse {
  summary: FleetSummary;
  rows: ScoredRow[];
  anomalies: AnomalyReport[];
}

const FUEL_NAIRA_PER_L = 1050;

export function breakdownCount(
  breakdown: Record<string, number>,
  ...keys: string[]
): number {
  return keys.reduce((sum, key) => sum + (breakdown[key] ?? 0), 0);
}

export function estimateLossNaira(breakdown: Record<string, number>): number {
  const fuelTheft = breakdownCount(
    breakdown,
    "fuel_theft",
    "fuel-theft",
    "fuel_theft_suspected"
  );
  const routeDev = breakdownCount(
    breakdown,
    "route_deviation",
    "route-deviation",
    "route_deviations"
  );
  const idle = breakdownCount(
    breakdown,
    "excessive_idle",
    "idle-excess",
    "idle_excess"
  );
  const privateUse = breakdownCount(breakdown, "private_use", "private-use");
  return (
    fuelTheft * 50 * FUEL_NAIRA_PER_L +
    routeDev * 15_000 +
    idle * 5_000 +
    privateUse * 10_000
  );
}

export function suspicionPercent(score: number): number {
  if (score <= 0) return Math.min(100, Math.round(Math.abs(score) * 100));
  return Math.max(0, Math.min(100, Math.round((0.5 - score) * 80)));
}

export async function analyzeFleetCsv(file: File): Promise<AnalyzeFleetResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${getBatchApiUrl()}/api/v1/analyze-fleet`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let detail = `Server error ${res.status}`;
    try {
      const err = (await res.json()) as { detail?: string };
      if (err.detail) detail = err.detail;
    } catch {
      const text = await res.text();
      if (text) detail = text;
    }
    throw new Error(detail);
  }
  return res.json() as Promise<AnalyzeFleetResponse>;
}

export async function checkBatchHealth(): Promise<{
  ok: boolean;
  modelLoaded?: boolean;
}> {
  try {
    const res = await fetch(`${getBatchApiUrl()}/healthz`, {
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { model_loaded?: boolean };
    return { ok: true, modelLoaded: data.model_loaded };
  } catch {
    return { ok: false };
  }
}
