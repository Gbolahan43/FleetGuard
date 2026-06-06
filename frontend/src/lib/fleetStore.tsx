"use client";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import type { Vehicle, Alert, FleetStats } from "@/types/fleet";
import { mockVehicles, mockAlerts, mockStats } from "@/data/mockData";

interface FleetContextType {
  vehicles: Vehicle[];
  alerts: Alert[];
  stats: FleetStats;
  selectedVehicle: Vehicle | null;
  selectedAlert: Alert | null;
  activeTab: "map" | "alerts" | "analytics";
  setSelectedVehicle: (v: Vehicle | null) => void;
  setSelectedAlert: (a: Alert | null) => void;
  setActiveTab: (tab: "map" | "alerts" | "analytics") => void;
  resolveAlert: (alertId: string) => void;
}

const FleetContext = createContext<FleetContextType | null>(null);

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [stats, setStats] = useState<FleetStats>(mockStats);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState<"map" | "alerts" | "analytics">(
    "map"
  );

  // Simulate live position updates
  useEffect(() => {
    const interval = setInterval(() => {
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.status === "offline" || v.status === "idle") return v;
          const speed = v.status === "alert" ? 2 : 20 + Math.random() * 40;
          const direction = v.id === "v1" ? 1 : v.id === "v4" ? -1 : 0.5;
          return {
            ...v,
            currentPosition: {
              ...v.currentPosition,
              lat: v.currentPosition.lat + (Math.random() - 0.5) * 0.0005,
              lng:
                v.currentPosition.lng + direction * 0.0003 + (Math.random() - 0.5) * 0.0002,
              speed,
              timestamp: Date.now(),
              fuelLevel: Math.max(5, v.currentPosition.fuelLevel - 0.05),
            },
          };
        })
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
