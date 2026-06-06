"use client";
import { useState } from "react";
import { AlertTriangle, CheckCircle, Filter, SlidersHorizontal } from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import { SeverityBadge, TypeBadge } from "@/components/ui/Badge";
import AlertDrawer from "./AlertDrawer";
import { formatDistanceToNow } from "date-fns";
import type { Alert, AlertSeverity } from "@/types/fleet";

export default function AlertsPanel() {
  const { alerts } = useFleet();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filter, setFilter] = useState<AlertSeverity | "all">("all");
  const [showResolved, setShowResolved] = useState(false);

  const filtered = alerts.filter((a) => {
    if (!showResolved && a.resolved) return false;
    if (filter !== "all" && a.severity !== filter) return false;
    return true;
  });

  const activeCount = alerts.filter((a) => !a.resolved).length;

  return (
    <div className="flex flex-col h-full bg-[#0a1628]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e3254] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertTriangle size={13} className="text-red-400" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">Alerts</span>
            {activeCount > 0 && (
              <span className="ml-2 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                {activeCount} active
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal size={12} className="text-slate-600" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as AlertSeverity | "all")}
            className="text-xs bg-[#0f1f35] border border-[#1e3254] rounded-lg px-2.5 py-1.5 text-slate-400 focus:outline-none focus:border-cyan-500/40 transition-colors"
          >
            <option value="all">All severity</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            onClick={() => setShowResolved((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
              showResolved
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-[#0f1f35] border-[#1e3254] text-slate-500 hover:text-slate-300"
            }`}
          >
            <CheckCircle size={11} />
            Resolved
          </button>
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-3">
              <CheckCircle size={18} className="text-emerald-500" />
            </div>
            <p className="text-sm text-slate-500">No alerts matching filter</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filtered.map((alert) => (
              <button
                key={alert.id}
                onClick={() => setSelectedAlert(alert)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
                  alert.resolved
                    ? "opacity-40 bg-[#0f1f35]/30 border-[#1e3254]/30 hover:opacity-60"
                    : alert.severity === "critical"
                    ? "bg-red-500/5 border-red-900/50 hover:border-red-700/50 hover:bg-red-500/8"
                    : alert.severity === "high"
                    ? "bg-orange-500/5 border-orange-900/40 hover:border-orange-700/40"
                    : "bg-[#0f1f35]/60 border-[#1e3254] hover:border-[#2d4a6e]"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <SeverityBadge severity={alert.severity} />
                    <TypeBadge type={alert.type} />
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0 font-data">
                    {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                  </span>
                </div>

                <p className="text-sm font-semibold text-white mb-0.5 font-mono tracking-tight">
                  {alert.vehiclePlate}
                  <span className="text-slate-500 font-sans font-normal ml-2 text-xs">
                    {alert.driverName}
                  </span>
                </p>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {alert.description}
                </p>

                {alert.fuelLost && !alert.resolved && (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <div className="h-px flex-1 bg-red-900/40" />
                    <p className="text-xs text-red-400 font-data font-semibold">
                      ₦{(alert.fuelLost * 1050).toLocaleString()} est. loss
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedAlert && (
        <AlertDrawer alert={selectedAlert} onClose={() => setSelectedAlert(null)} />
      )}
    </div>
  );
}