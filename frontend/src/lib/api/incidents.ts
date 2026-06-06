import { getApiUrl } from "@/lib/env";
import type { Alert, AlertSeverity, AlertType, Vehicle, VehicleStatus } from "@/types/fleet";

export interface IncidentRecord {
  incident_id: string;
  vehicle_id: string;
  timestamp: string;
  source?: string;
  anomaly_score?: string;
  lat?: string;
  lng?: string;
  speed_kmh?: string;
  fuel_level_pct?: string;
  fuel_delta?: string;
  idle_minutes?: string;
  report?: string;
  created_at?: string;
}

export interface IncidentsResponse {
  incidents: IncidentRecord[];
}

function parseNum(value: string | undefined, fallback = 0): number {
  if (value == null || value === "") return fallback;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function inferAlertType(incident: IncidentRecord): AlertType {
  const text = (incident.report ?? "").toLowerCase();
  if (text.includes("fuel")) return "fuel-theft";
  if (text.includes("route") || text.includes("zone") || text.includes("deviat"))
    return "route-deviation";
  if (text.includes("idle")) return "idle-excess";
  if (text.includes("stop") || text.includes("unauthorized"))
    return "unauthorized-stop";
  const fuelDelta = parseNum(incident.fuel_delta);
  if (fuelDelta < -5) return "fuel-theft";
  return "route-deviation";
}

function inferSeverity(score: number): AlertSeverity {
  const abs = Math.abs(score);
  if (abs >= 0.6) return "critical";
  if (abs >= 0.4) return "high";
  if (abs >= 0.2) return "medium";
  return "low";
}

export function mapIncidentToAlert(incident: IncidentRecord): Alert {
  const score = parseNum(incident.anomaly_score);
  const fuelDelta = parseNum(incident.fuel_delta);
  const lat = parseNum(incident.lat, 6.5244);
  const lng = parseNum(incident.lng, 3.3792);
  const type = inferAlertType(incident);

  return {
    id: incident.incident_id,
    vehicleId: incident.vehicle_id,
    vehiclePlate: incident.vehicle_id,
    driverName: "Fleet driver",
    type,
    severity: inferSeverity(score),
    timestamp: new Date(incident.timestamp || incident.created_at || Date.now()).getTime(),
    location: { lat, lng },
    description:
      incident.report?.slice(0, 200) ||
      `Anomaly detected for ${incident.vehicle_id}`,
    aiAnalysis: incident.report,
    fuelLost: fuelDelta < 0 ? Math.abs(fuelDelta) : undefined,
    stopDurationMin: parseNum(incident.idle_minutes) || undefined,
    resolved: false,
  };
}

export function buildVehiclesFromIncidents(incidents: IncidentRecord[]): Vehicle[] {
  const byVehicle = new Map<string, IncidentRecord>();
  for (const inc of incidents) {
    const existing = byVehicle.get(inc.vehicle_id);
    if (!existing || inc.timestamp > existing.timestamp) {
      byVehicle.set(inc.vehicle_id, inc);
    }
  }

  return Array.from(byVehicle.values()).map((inc) => {
    const lat = parseNum(inc.lat, 6.5244);
    const lng = parseNum(inc.lng, 3.3792);
    const fuel = parseNum(inc.fuel_level_pct, 50);
    const speed = parseNum(inc.speed_kmh, 0);
    const status: VehicleStatus = speed > 5 ? "alert" : "idle";

    return {
      id: inc.vehicle_id,
      plateNumber: inc.vehicle_id,
      driverName: "Fleet driver",
      driverPhone: "",
      vehicleType: "truck",
      status,
      currentPosition: {
        lat,
        lng,
        timestamp: new Date(inc.timestamp).getTime(),
        speed,
        fuelLevel: fuel,
      },
      routeHistory: [],
      plannedRoute: [],
      fuelCapacity: 100,
      currentFuel: fuel,
      totalDistance: 0,
      todayDistance: 0,
      alerts: [],
      assignedZone: "Lagos",
    };
  });
}

export async function fetchIncidents(limit = 50): Promise<IncidentRecord[]> {
  const base = getApiUrl();
  if (!base) return [];

  const res = await fetch(`${base}/incidents?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load incidents (${res.status})`);
  }
  const data = (await res.json()) as IncidentsResponse;
  return data.incidents ?? [];
}
