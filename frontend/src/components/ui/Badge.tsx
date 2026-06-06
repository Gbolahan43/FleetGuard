import type { AlertSeverity, AlertType } from "@/types/fleet";

const severityConfig = {
  critical: "bg-red-900/60 text-red-300 border border-red-700/50",
  high: "bg-orange-900/60 text-orange-300 border border-orange-700/50",
  medium: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
  low: "bg-slate-800/60 text-slate-400 border border-slate-600/50",
};

const typeLabels: Record<AlertType, string> = {
  "fuel-theft": "⛽ Fuel Theft",
  "route-deviation": "🗺 Route Deviation",
  "unauthorized-stop": "🛑 Unauth. Stop",
  speeding: "💨 Speeding",
  "idle-excess": "⏱ Idle Excess",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityConfig[severity]}`}
    >
      {severity.toUpperCase()}
    </span>
  );
}

export function TypeBadge({ type }: { type: AlertType }) {
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/50">
      {typeLabels[type]}
    </span>
  );
}
