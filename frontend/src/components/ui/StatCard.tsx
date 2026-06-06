"use client";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  variant?: "default" | "danger" | "warning" | "success";
  pulse?: boolean;
}

export default function StatCard({ label, value, sub, icon: Icon, variant = "default", pulse = false }: StatCardProps) {
  return (
    <div
      className="relative rounded-xl border overflow-hidden p-4 transition-all duration-300"
      style={{
        background: "rgba(10,22,40,0.85)",
        borderColor:
          variant === "danger"  ? "rgba(127,29,29,0.5)"  :
          variant === "warning" ? "rgba(120,53,15,0.5)"  :
          variant === "success" ? "rgba(6,78,59,0.5)"    :
          "#1e3254",
        boxShadow:
          variant === "danger"  ? "0 0 20px rgba(239,68,68,0.06)"   :
          variant === "warning" ? "0 0 20px rgba(251,191,36,0.05)"  :
          variant === "success" ? "0 0 20px rgba(52,211,153,0.05)"  :
          "none",
      }}
    >
      {/* Top accent line */}
      <div
        className="absolute top-0 left-4 right-4 h-px"
        style={{
          background:
            variant === "danger"  ? "linear-gradient(90deg,transparent,rgba(239,68,68,0.5),transparent)"   :
            variant === "warning" ? "linear-gradient(90deg,transparent,rgba(251,191,36,0.5),transparent)"  :
            variant === "success" ? "linear-gradient(90deg,transparent,rgba(52,211,153,0.5),transparent)"  :
            "linear-gradient(90deg,transparent,rgba(34,211,238,0.4),transparent)",
        }}
      />

      {/* Pulse dot */}
      {pulse && (
        <span className="absolute top-3 right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
      )}

      {/* Icon box */}
      <div
        className="w-8 h-8 rounded-lg border flex items-center justify-center mb-3"
        style={{
          background:
            variant === "danger"  ? "rgba(239,68,68,0.1)"   :
            variant === "warning" ? "rgba(251,191,36,0.1)"  :
            variant === "success" ? "rgba(52,211,153,0.1)"  :
            "rgba(34,211,238,0.1)",
          borderColor:
            variant === "danger"  ? "rgba(239,68,68,0.25)"   :
            variant === "warning" ? "rgba(251,191,36,0.25)"  :
            variant === "success" ? "rgba(52,211,153,0.25)"  :
            "rgba(34,211,238,0.25)",
        }}
      >
        <Icon
          size={15}
          style={{
            color:
              variant === "danger"  ? "#f87171" :
              variant === "warning" ? "#fbbf24" :
              variant === "success" ? "#34d399" :
              "#22d3ee",
          }}
        />
      </div>

      {/* Value */}
      <p
        className="text-2xl font-bold tracking-tight leading-none font-data"
        style={{
          color:
            variant === "danger"  ? "#fca5a5" :
            variant === "warning" ? "#fde68a" :
            variant === "success" ? "#6ee7b7" :
            "#ffffff",
        }}
      >
        {value}
      </p>

      {/* Label */}
      <p className="text-xs mt-1.5 font-medium text-slate-500">{label}</p>

      {/* Sub */}
      {sub && (
        <p
          className="text-xs mt-0.5"
          style={{
            color:
              variant === "danger"  ? "rgba(248,113,113,0.5)" :
              variant === "warning" ? "rgba(251,191,36,0.4)"  :
              variant === "success" ? "rgba(52,211,153,0.4)"  :
              "#475569",
          }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}