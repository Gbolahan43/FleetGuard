"use client";
import { X, Navigation, Fuel, AlertTriangle, Clock, Phone, MapPin, Route } from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import { SeverityBadge } from "@/components/ui/Badge";
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { color: string; label: string }> = {
  "on-route": { color: "text-cyan-400", label: "On Route" },
  idle:       { color: "text-slate-400", label: "Idle" },
  alert:      { color: "text-red-400",  label: "Alert" },
  offline:    { color: "text-slate-600", label: "Offline" },
};

function formatCoord(value: number): string {
  return value.toFixed(4);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeHistoryKm(history: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < history.length; i++) {
    total += haversineKm(
      history[i - 1].lat,
      history[i - 1].lng,
      history[i].lat,
      history[i].lng
    );
  }
  return Math.round(total * 10) / 10;
}

export default function VehiclePanel() {
  const { selectedVehicle, setSelectedVehicle, alerts, setSelectedAlert } = useFleet();
  if (!selectedVehicle) return null;

  const vehicleAlerts = alerts.filter(a => a.vehicleId === selectedVehicle.id && !a.resolved);
  const status = statusConfig[selectedVehicle.status];
  const fuel = Math.round(selectedVehicle.currentPosition.fuelLevel);
  const fuelColor = fuel < 20 ? "bg-red-500" : fuel < 40 ? "bg-amber-500" : "bg-cyan-500";
  const trackKm = routeHistoryKm(selectedVehicle.routeHistory);
  const planned = selectedVehicle.plannedRoute;
  const routeStart = planned[0];
  const routeEnd = planned[planned.length - 1];
  const deviationAlert = vehicleAlerts.find((a) => a.type === "route-deviation");

  return (
    <div className="absolute top-4 right-4 w-72 z-[1000] animate-fade-up">
      <div className="bg-[#0a1628]/95 backdrop-blur-xl border border-[#1e3254] rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        {/* Top accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e3254]">
          <div>
            <p className="font-mono font-bold text-white text-sm tracking-wider">
              {selectedVehicle.plateNumber}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-xs font-medium ${status.color}`}>● {status.label}</span>
              <span className="text-slate-700">·</span>
              <span className="text-xs text-slate-600 capitalize">{selectedVehicle.vehicleType}</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedVehicle(null)}
            className="w-6 h-6 rounded-lg bg-[#0f1f35] border border-[#1e3254] flex items-center justify-center text-slate-500 hover:text-white hover:border-[#2d4a6e] transition-all"
          >
            <X size={12} />
          </button>
        </div>

        {/* Driver */}
        <div className="px-4 py-3 border-b border-[#1e3254] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0f1f35] border border-[#1e3254] flex items-center justify-center text-xs font-bold text-cyan-400 font-mono shrink-0">
            {selectedVehicle.driverName.split(" ").map(n => n[0]).join("")}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{selectedVehicle.driverName}</p>
            <div className="flex items-center gap-1 text-[10px] text-slate-500">
              <Phone size={9} />
              <span className="font-data">{selectedVehicle.driverPhone}</span>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-px bg-[#0f1f35] border-b border-[#1e3254]">
          {[
            { icon: Navigation, label: "Speed", value: `${Math.round(selectedVehicle.currentPosition.speed)}`, unit: "km/h", color: "text-cyan-400" },
            { icon: Clock, label: "Today", value: `${selectedVehicle.todayDistance}`, unit: "km", color: "text-purple-400" },
          ].map(({ icon: Icon, label, value, unit, color }) => (
            <div key={label} className="bg-[#0a1628] px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={11} className={color} />
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-white font-data font-bold text-lg leading-none">
                {value}
                <span className="text-xs text-slate-600 font-normal ml-1">{unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Fuel bar */}
        <div className="px-4 py-3 border-b border-[#1e3254]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Fuel size={11} className="text-amber-400" />
              <span className="text-[10px] text-slate-600 uppercase tracking-wider">Fuel Level</span>
            </div>
            <span className={`text-xs font-data font-bold ${fuel < 20 ? "text-red-400" : fuel < 40 ? "text-amber-400" : "text-cyan-400"}`}>
              {fuel}%
            </span>
          </div>
          <div className="h-1.5 bg-[#0f1f35] rounded-full overflow-hidden border border-[#1e3254]/50">
            <div
              className={`h-full rounded-full transition-all duration-700 ${fuelColor}`}
              style={{ width: `${fuel}%` }}
            />
          </div>
        </div>

        {/* Zone */}
        <div className="px-4 py-2.5 flex items-center gap-1.5 border-b border-[#1e3254]">
          <MapPin size={10} className="text-slate-600" />
          <span className="text-[10px] text-slate-600">Zone:</span>
          <span className="text-[10px] text-slate-400">{selectedVehicle.assignedZone}</span>
        </div>

        {/* Route info */}
        <div className="px-4 py-3 border-b border-[#1e3254] space-y-2.5">
          <div className="flex items-center gap-1.5">
            <Route size={11} className="text-cyan-400" />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.12em]">
              Route Info
            </span>
          </div>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 shrink-0">Approved route</span>
              <span className="text-slate-300 text-right font-data">
                {routeStart && routeEnd
                  ? `${formatCoord(routeStart[0])}, ${formatCoord(routeStart[1])} → ${formatCoord(routeEnd[0])}, ${formatCoord(routeEnd[1])}`
                  : "Not configured"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 shrink-0">Current position</span>
              <span className="text-slate-300 font-data">
                {formatCoord(selectedVehicle.currentPosition.lat)}, {formatCoord(selectedVehicle.currentPosition.lng)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 shrink-0">Recent track</span>
              <span className="text-slate-300">
                {trackKm} km · {selectedVehicle.routeHistory.length} pings
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 shrink-0">Today&apos;s distance</span>
              <span className="text-slate-300">{selectedVehicle.todayDistance} km</span>
            </div>
            {deviationAlert?.deviationKm != null && (
              <div className="flex justify-between gap-2">
                <span className="text-red-400/80 shrink-0">Route deviation</span>
                <span className="text-red-400 font-data">{deviationAlert.deviationKm.toFixed(1)} km off route</span>
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        {vehicleAlerts.length > 0 && (
          <div className="p-3 space-y-2">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.12em] px-1">
              Active Alerts
            </p>
            {vehicleAlerts.slice(0, 2).map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => setSelectedAlert(alert)}
                className="w-full text-left bg-red-500/5 border border-red-900/50 rounded-xl p-3 hover:bg-red-500/10 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <SeverityBadge severity={alert.severity} />
                  <span className="text-[10px] text-slate-600 font-data">
                    {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{alert.description}</p>
                {alert.fuelLost && (
                  <p className="text-xs text-red-400 font-data font-semibold mt-1.5">
                    ₦{(alert.fuelLost * 1050).toLocaleString()} estimated loss
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Bottom accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>
    </div>
  );