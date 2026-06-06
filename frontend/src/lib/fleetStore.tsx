// lib/fleetStore.tsx
"use client";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { Vehicle, Alert, FleetStats, GpsPoint } from "@/types/fleet";
import { getApiUrl, getBatchApiUrl } from "@/lib/env";
import {
  buildVehiclesFromIncidents,
  fetchIncidents,
  mapIncidentToAlert,
} from "@/lib/api/incidents";

interface MLScoredRecord {
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

interface MLAnomaly {
  vehicle_id: string;
  timestamp: string;
  lat: number;
  lng: number;
  score: number;
  anomaly_type: string;
  report: string;
}

interface MLSummary {
  total_rows: number;
  total_vehicles: number;
  anomaly_count: number;
  anomaly_rate_pct: number;
  avg_score?: number;
  min_score?: number;
  max_score?: number;
  breakdown?: Record<string, number>;
}

const PLATE_PREFIXES = ["LND", "FST", "KJA", "ABJ", "PHC"];
const DRIVER_NAMES = [
  "Emeka Okafor", "Tunde Adeyemi", "Chioma Nwosu",
  "Babajide Fashola", "Ngozi Ibe", "Ahmed Bello",
  "Fatima Yusuf", "Chuka Obi", "Grace Essien", "Musa Danladi",
];
const ZONES = [
  "Lagos Island", "Victoria Island", "Ikeja", "Surulere", "Lekki",
  "Apapa", "Yaba", "Maryland", "Ikoyi", "Ajah",
];

const ANOMALY_TYPE_MAP: Record<string, Alert["type"]> = {
  excessive_idle: "idle-excess",
  fuel_theft: "fuel-theft",
  private_use: "route-deviation",
  route_deviation: "route-deviation",
  unauthorized_stop: "unauthorized-stop",
  speeding: "speeding",
  anomaly: "route-deviation",
};

const SEVERITY_MAP: Record<string, Alert["severity"]> = {
  excessive_idle: "medium",
  fuel_theft: "critical",
  private_use: "high",
  route_deviation: "high",
  unauthorized_stop: "medium",
  speeding: "low",
  anomaly: "medium",
};

function deriveStatus(record: MLScoredRecord): Vehicle["status"] {
  if (record.is_anomaly && record.anomaly_type !== "normal") return "alert";
  if (record.speed_kmh < 1) return "idle";
  if (record.speed_kmh < 3) return "idle";
  return "on-route";
}

function generateRouteHistory(
  baseLat: number,
  baseLng: number,
  points: number = 15
): GpsPoint[] {
  const history: GpsPoint[] = [];
  const startLat = baseLat - 0.015 + (Math.random() - 0.5) * 0.01;
  const startLng = baseLng - 0.015 + (Math.random() - 0.5) * 0.01;
  let fuel = 60 + Math.random() * 30;
  const now = Date.now();

  for (let i = 0; i < points; i++) {
    const progress = (i + 1) / points;
    const lat = startLat + (baseLat - startLat) * progress + (Math.random() - 0.5) * 0.001;
    const lng = startLng + (baseLng - startLng) * progress + (Math.random() - 0.5) * 0.001;
    fuel -= 0.2 + Math.random() * 0.4;
    history.push({
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      timestamp: now - (points - i) * 120000,
      speed: 10 + Math.random() * 50,
      fuelLevel: Math.max(5, fuel),
    });
  }
  return history;
}

function getLatestRecords(records: MLScoredRecord[]): MLScoredRecord[] {
  if (!records || !Array.isArray(records)) return [];
  const latest: Map<string, MLScoredRecord> = new Map();
  records.forEach((r) => {
    const existing = latest.get(r.vehicle_id);
    if (!existing || new Date(r.timestamp) > new Date(existing.timestamp)) {
      latest.set(r.vehicle_id, r);
    }
  });
  return Array.from(latest.values());
}

function mapVehicle(record: MLScoredRecord, index: number): Vehicle {
  const status = deriveStatus(record);
  const baseLat = record.lat;
  const baseLng = record.lng;

  return {
    id: record.vehicle_id,
    plateNumber: `${PLATE_PREFIXES[index % PLATE_PREFIXES.length]}-${String(100 + index).slice(1)}-${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + ((index + 1) % 26))}`,
    driverName: DRIVER_NAMES[index % DRIVER_NAMES.length],
    driverPhone: `+234 80${String(300000000 + index * 1234567).slice(0, 8)}`,
    vehicleType: index % 3 === 0 ? "truck" : index % 3 === 1 ? "van" : "motorcycle",
    status,
    currentPosition: {
      lat: baseLat,
      lng: baseLng,
      timestamp: Date.now(),
      speed: record.speed_kmh,
      fuelLevel: record.fuel_level_pct,
    },
    routeHistory: generateRouteHistory(baseLat, baseLng, 15 + (index % 10)),
    plannedRoute: [
      [baseLat - 0.02, baseLng - 0.02],
      [baseLat, baseLng],
      [baseLat + 0.01, baseLng + 0.02],
    ],
    fuelCapacity: index % 3 === 0 ? 100 : index % 3 === 1 ? 80 : 20,
    currentFuel: record.fuel_level_pct,
    totalDistance: 5000 + index * 3700,
    todayDistance: Math.round(20 + Math.random() * 80),
    alerts: [],
    assignedZone: ZONES[index % ZONES.length],
  };
}

function mapAlerts(
  anomalies: MLAnomaly[],
  vehicleMap: Map<string, Vehicle>
): Alert[] {
  if (!anomalies || !Array.isArray(anomalies)) return [];
  return anomalies.map((a, i) => {
    const vehicle = vehicleMap.get(a.vehicle_id);
    return {
      id: `ml-alert-${a.vehicle_id}-${i}`,
      vehicleId: a.vehicle_id,
      vehiclePlate: vehicle?.plateNumber ?? a.vehicle_id,
      driverName: vehicle?.driverName ?? "Unknown",
      type: ANOMALY_TYPE_MAP[a.anomaly_type] ?? "route-deviation",
      severity: SEVERITY_MAP[a.anomaly_type] ?? "medium",
      timestamp: new Date(a.timestamp).getTime(),
      location: { lat: a.lat, lng: a.lng },
      description: a.report,
      aiAnalysis: a.report,
      fuelLost: a.anomaly_type === "fuel_theft" ? 10 + Math.random() * 20 : undefined,
      deviationKm: a.anomaly_type === "route_deviation" ? 2 + Math.random() * 5 : undefined,
      stopDurationMin: a.anomaly_type === "excessive_idle" ? 30 + Math.random() * 90 : undefined,
      resolved: false,
    };
  });
}

function computeStats(vehicles: Vehicle[], alerts: Alert[], summary?: MLSummary): FleetStats {
  const totalVehicles = summary?.total_vehicles ?? vehicles.length;
  const activeVehicles = vehicles.filter((v) => v.status !== "offline").length;
  const alertsToday = alerts.filter((a) => !a.resolved).length;
  const fuelTheftLiters = alerts
    .filter((a) => a.type === "fuel-theft" && !a.resolved)
    .reduce((sum, a) => sum + (a.fuelLost ?? 0), 0);
  const estimatedLossNaira = Math.round(fuelTheftLiters * 1050);
  const routeCompliancePercent = totalVehicles > 0
    ? Math.round(((totalVehicles - alerts.filter((a) => a.type === "route-deviation" && !a.resolved).length) / totalVehicles) * 100)
    : 100;
  const avgFuelEfficiency = vehicles.length > 0
    ? Math.round(vehicles.reduce((sum, v) => sum + v.currentPosition.fuelLevel, 0) / vehicles.length)
    : 0;

  return {
    totalVehicles,
    activeVehicles,
    alertsToday,
    fuelTheftLiters: Math.round(fuelTheftLiters * 10) / 10,
    estimatedLossNaira,
    routeCompliancePercent,
    avgFuelEfficiency,
  };
}

const DEFAULT_STATS: FleetStats = {
  totalVehicles: 0,
  activeVehicles: 0,
  alertsToday: 0,
  fuelTheftLiters: 0,
  estimatedLossNaira: 0,
  routeCompliancePercent: 100,
  avgFuelEfficiency: 0,
};

interface FleetContextType {
  vehicles: Vehicle[];
  alerts: Alert[];
  stats: FleetStats;
  selectedVehicle: Vehicle | null;
  selectedAlert: Alert | null;
  activeTab: "map" | "alerts" | "analytics";
  isLoading: boolean;
  error: string | null;
  liveMode: boolean;
  setSelectedVehicle: (v: Vehicle | null) => void;
  setSelectedAlert: (a: Alert | null) => void;
  setActiveTab: (tab: "map" | "alerts" | "analytics") => void;
  resolveAlert: (alertId: string) => void;
}

const FleetContext = createContext<FleetContextType | null>(null);
const POLL_MS = 15_000;

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const apiUrl = getApiUrl();
  const liveMode = Boolean(apiUrl);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<FleetStats>(DEFAULT_STATS);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "alerts" | "analytics">("map");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const refreshFromApi = useCallback(async () => {
    if (!apiUrl) return;
    try {
      const incidents = await fetchIncidents(50);
      if (incidents.length === 0) {
        setIsLoading(false);
        return;
      }

      const mappedAlerts = incidents.map(mapIncidentToAlert);
      const apiVehicles = buildVehiclesFromIncidents(incidents);

      setAlerts(mappedAlerts);
      setVehicles(apiVehicles);
      setStats(computeStats(apiVehicles, mappedAlerts));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load incidents");
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!liveMode) return;
    refreshFromApi();
    const interval = setInterval(refreshFromApi, POLL_MS);
    return () => clearInterval(interval);
  }, [liveMode, refreshFromApi]);

  useEffect(() => {
    if (liveMode) return;
    if (hasFetched.current) return;
    hasFetched.current = true;

    async function fetchAnalyzedFleet() {
      setIsLoading(true);
      setError(null);

      try {
        const csvRes = await fetch("/fleetguard_telemetry.csv");
        if (!csvRes.ok) throw new Error("CSV not found in /public");
        const csvText = await csvRes.text();

        const formData = new FormData();
        formData.append("file", new Blob([csvText], { type: "text/csv" }), "fleetguard_telemetry.csv");

        const response = await fetch(`${getBatchApiUrl()}/api/v1/analyze-fleet`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`API error ${response.status}: ${errText}`);
        }

        const data = await response.json();
        if (!data?.rows || !Array.isArray(data.rows)) {
          throw new Error("API response missing 'rows' array");
        }

        const latestRecords = getLatestRecords(data.rows);
        if (latestRecords.length === 0) {
          throw new Error("No vehicle records found in ML response");
        }

        const mappedVehicles = latestRecords.map((r, i) => mapVehicle(r, i));
        const vehicleMap = new Map<string, Vehicle>();
        mappedVehicles.forEach((v) => vehicleMap.set(v.id, v));

        const mappedAlerts = mapAlerts(data.anomalies ?? [], vehicleMap);
        mappedVehicles.forEach((v) => {
          v.alerts = mappedAlerts.filter((a) => a.vehicleId === v.id);
        });
        mappedVehicles.forEach((v) => {
          if (v.alerts.some((a) => !a.resolved) && v.status !== "alert") {
            v.status = "alert";
          }
        });

        setVehicles(mappedVehicles);
        setAlerts(mappedAlerts);
        setStats(computeStats(mappedVehicles, mappedAlerts, data.summary));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load fleet data");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalyzedFleet();
  }, [liveMode]);

  useEffect(() => {
    if (vehicles.length === 0) return;
    setStats(computeStats(vehicles, alerts));
  }, [vehicles, alerts]);

  useEffect(() => {
    if (vehicles.length === 0) return;

    const interval = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.status === "offline") return v;

          const hasActiveAlert = v.alerts.some((a) => !a.resolved);
          const speed = hasActiveAlert || v.status === "idle"
            ? 0.5 + Math.random() * 3
            : 15 + Math.random() * 40;

          const direction = v.id.charCodeAt(v.id.length - 1) % 2 === 0 ? 1 : -1;
          const newLat = v.currentPosition.lat + (Math.random() - 0.5) * 0.0005;
          const newLng = v.currentPosition.lng + direction * 0.0003 + (Math.random() - 0.5) * 0.0002;
          const newFuel = Math.max(2, v.currentPosition.fuelLevel - (speed > 5 ? 0.04 : 0.01));

          const newHistoryPoint: GpsPoint = {
            lat: newLat,
            lng: newLng,
            timestamp: Date.now(),
            speed,
            fuelLevel: newFuel,
          };

          let newStatus = v.status;
          if (hasActiveAlert) {
            newStatus = "alert";
          } else if (speed > 3) {
            newStatus = "on-route";
          } else if (speed <= 1) {
            newStatus = "idle";
          }

          return {
            ...v,
            status: newStatus,
            currentPosition: {
              ...v.currentPosition,
              lat: newLat,
              lng: newLng,
              speed,
              fuelLevel: newFuel,
              timestamp: Date.now(),
            },
            routeHistory: [...v.routeHistory.slice(-49), newHistoryPoint],
            currentFuel: newFuel,
          };
        })
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [vehicles.length]);

  const resolveAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
    );
    setStats((prev) => ({
      ...prev,
      alertsToday: Math.max(0, prev.alertsToday - 1),
    }));
  }, []);

  return (
    <FleetContext.Provider
      value={{
        vehicles,
        alerts,
        stats,
        selectedVehicle,
        selectedAlert,
        activeTab,
        isLoading,
        error,
        liveMode,
        setSelectedVehicle,
        setSelectedAlert,
        setActiveTab,
        resolveAlert,
      }}
    >
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet() {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error("useFleet must be used within FleetProvider");
  return ctx;
}
