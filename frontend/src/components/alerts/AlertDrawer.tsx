"use client";
import { useState } from "react";
import {
  X,
  Brain,
  CheckCircle,
  MapPin,
  Clock,
  Fuel,
  TrendingDown,
  AlertOctagon,
} from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import { SeverityBadge, TypeBadge } from "@/components/ui/Badge";
import { formatDistanceToNow } from "date-fns";
import type { Alert } from "@/types/fleet";

interface AlertDrawerProps {
  alert: Alert;
  onClose: () => void;
}

export default function AlertDrawer({ alert, onClose }: AlertDrawerProps) {
  const { resolveAlert, vehicles } = useFleet();
  const [aiAnalysis, setAiAnalysis] = useState<string>(
    alert.aiAnalysis || ""
  );
  const [loading, setLoading] = useState(false);

  const vehicle = vehicles.find((v) => v.id === alert.vehicleId);
  const historyCount = vehicle?.alerts.length ?? 0;

  async function fetchAIAnalysis() {
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert,
          vehicleHistory: `${historyCount} alerts this month`,
        }),
      });
      const data = await res.json();
      setAiAnalysis(data.analysis);
    } catch {
      setAiAnalysis("Failed to fetch AI analysis. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div
          className={`sticky top-0 bg-slate-900 p-5 border-b border-slate-700/50 flex items-start justify-between z-10 ${
            alert.resolved ? "opacity-60" : ""
          }`}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={alert.severity} />
              <TypeBadge type={alert.type} />
              {alert.resolved && (
                <span className="text-xs text-emerald-400 bg-emerald-900/30 border border-emerald-800/30 px-2 py-0.5 rounded-full">
                  ✓ Resolved
                </span>
              )}
            </div>
            <h2 className="text-white font-bold text-base">
              {alert.vehiclePlate} · {alert.driverName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Description */}
          <div className="flex items-start gap-3">
            <AlertOctagon
              size={16}
              className={
                alert.severity === "critical" ? "text-red-400" : "text-amber-400"
              }
            />
            <p className="text-sm text-slate-300">{alert.description}</p>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <Clock size={11} />
                <span>Detected</span>
              </div>
              <p className="text-sm text-white">
                {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
              </p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                <MapPin size={11} />
                <span>Location</span>
              </div>
              <p className="text-sm text-white font-mono text-xs">
                {alert.location.lat.toFixed(4)}, {alert.location.lng.toFixed(4)}
              </p>
            </div>
            {alert.fuelLost && (
              <div className="bg-red-950/40 border border-red-900/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-red-400/70 text-xs mb-1">
                  <Fuel size={11} />
                  <span>Fuel Lost</span>
                </div>
                <p className="text-sm text-red-300 font-bold">{alert.fuelLost}L</p>
                <p className="text-xs text-red-500">
                  ₦{(alert.fuelLost * 1050).toLocaleString()}
                </p>
              </div>
            )}
            {alert.deviationKm && (
              <div className="bg-amber-950/30 border border-amber-900/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-amber-400/70 text-xs mb-1">
                  <TrendingDown size={11} />
                  <span>Deviation</span>
                </div>
                <p className="text-sm text-amber-300 font-bold">
                  {alert.deviationKm}km
                </p>
              </div>
            )}
            {alert.stopDurationMin && (
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-1">
                  <Clock size={11} />
                  <span>Stop duration</span>
                </div>
                <p className="text-sm text-white font-bold">
                  {alert.stopDurationMin} min
                </p>
              </div>
            )}
          </div>

          {/* AI Analysis */}
          <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-900/30">
              <div className="flex items-center gap-2">
                <Brain size={14} className="text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">
                  AI Analysis
                </span>
              </div>
              <button
                onClick={fetchAIAnalysis}
                disabled={loading}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "↻ Re-analyze"}
              </button>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center gap-2 text-cyan-400/60">
                  <div className="w-3 h-3 border border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" />
                  <span className="text-xs">Querying FleetGuard AI...</span>
                </div>
              ) : aiAnalysis ? (
                <p className="text-sm text-slate-300 leading-relaxed">{aiAnalysis}</p>
              ) : (
                <button
                  onClick={fetchAIAnalysis}
                  className="w-full py-2 text-sm text-cyan-400/70 hover:text-cyan-400 transition-colors"
                >
                  Click to generate AI analysis →
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          {!alert.resolved && (
            <button
              onClick={() => {
                resolveAlert(alert.id);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 hover:bg-emerald-900/50 transition-colors text-sm font-medium"
            >
              <CheckCircle size={16} />
              Mark as Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
