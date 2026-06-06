"use client";
import { useFleet } from "@/lib/fleetStore";
import { Truck, Bike, Package, Wifi, WifiOff, ChevronRight } from "lucide-react";
import type { Vehicle } from "@/types/fleet";

const statusDot: Record<string, { bg: string; shadow?: string }> = {
  "on-route": { bg: "#22d3ee", shadow: "0 0 6px rgba(34,211,238,0.8)" },
  idle:       { bg: "#475569" },
  alert:      { bg: "#f87171", shadow: "0 0 6px rgba(248,113,113,0.8)" },
  offline:    { bg: "#1e293b" },
};

const vehicleIcon = { truck: Truck, van: Package, motorcycle: Bike };

export default function VehicleList() {
  const { vehicles, selectedVehicle, setSelectedVehicle, setActiveTab, setSelectedAlert, alerts } = useFleet();

  function handleSelect(v: Vehicle) {
    setSelectedVehicle(v);
    setActiveTab("map");
  }

  function handleAlertClick(e: React.MouseEvent, v: Vehicle) {
    e.stopPropagation();
    const alert = alerts.find((a) => a.vehicleId === v.id && !a.resolved);
    if (!alert) return;
    setSelectedVehicle(v);
    setSelectedAlert(alert);
    setActiveTab("map");
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#0a1628" }}>
      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid #1e3254" }}>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "#334155" }}>
          Fleet Vehicles
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#475569" }}>
          {vehicles.filter(v => v.status !== "offline").length} active
        </p>
      </div>

      {/* Vehicle list */}
      <div className="flex-1 overflow-y-auto">
        {vehicles.map((v) => {
          const Icon = vehicleIcon[v.vehicleType];
          const dot = statusDot[v.status];
          const activeAlerts = alerts.filter(a => a.vehicleId === v.id && !a.resolved).length;
          const isSelected = selectedVehicle?.id === v.id;
          const fuelPct = Math.round(v.currentFuel);
          const fuelBg = fuelPct < 20 ? "#ef4444" : fuelPct < 40 ? "#f59e0b" : "#22d3ee";

          return (
            <button
              key={v.id}
              onClick={() => handleSelect(v)}
              className="group w-full text-left px-3 py-3 transition-all duration-200 relative"
              style={{
                borderBottom: "1px solid rgba(30,50,84,0.5)",
                borderLeft: isSelected ? "2px solid #22d3ee" : "2px solid transparent",
                background: isSelected ? "rgba(34,211,238,0.04)" : "transparent",
              }}
            >
              {isSelected && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, rgba(34,211,238,0.05), transparent)" }}
                />
              )}

              <div className="flex items-center gap-2.5">
                {/* Icon */}
                <div
                  className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background:
                      v.status === "alert" ? "rgba(248,113,113,0.1)" :
                      isSelected ? "rgba(34,211,238,0.1)" :
                      "#0f1f35",
                    border:
                      v.status === "alert" ? "1px solid rgba(248,113,113,0.2)" :
                      isSelected ? "1px solid rgba(34,211,238,0.2)" :
                      "1px solid #1e3254",
                  }}
                >
                  <Icon
                    size={14}
                    style={{
                      color:
                        v.status === "alert" ? "#f87171" :
                        isSelected ? "#22d3ee" :
                        "#475569",
                    }}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5">
                    {v.status === "offline"
                      ? <WifiOff size={8} style={{ color: "#1e293b" }} />
                      : <Wifi size={8} style={{ color: "#22d3ee" }} />
                    }
                  </span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background: dot.bg,
                        boxShadow: dot.shadow,
                        animation: v.status === "alert" ? "pulse 1s ease-in-out infinite" : undefined,
                      }}
                    />
                    <p className="text-xs font-mono font-semibold text-white truncate leading-none">
                      {v.plateNumber}
                    </p>
                  </div>
                  <p className="text-[10px] truncate" style={{ color: "#475569" }}>{v.driverName}</p>
                </div>

                {/* Badge / chevron */}
                {activeAlerts > 0 ? (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleAlertClick(e, v)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") handleAlertClick(e as unknown as React.MouseEvent, v);
                    }}
                    className="shrink-0 text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      color: "#f87171",
                      border: "1px solid rgba(239,68,68,0.3)",
                    }}
                  >
                    {activeAlerts}
                  </span>
                ) : (
                  <ChevronRight size={12} style={{ color: "#1e3254" }} className="shrink-0" />
                )}
              </div>

              {/* Fuel bar */}
              <div className="mt-2.5 flex items-center gap-2 pl-[42px]">
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: "#0f1f35", border: "1px solid rgba(30,50,84,0.5)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${fuelPct}%`, backgrou