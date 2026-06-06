"use client";
import { Map, Bell, BarChart3, Truck, Radio, ExternalLink } from "lucide-react";
import { useFleet } from "@/lib/fleetStore";
import Link from "next/link";

export default function TopBar() {
  const { stats, activeTab, setActiveTab, alerts, liveMode } = useFleet();
  const activeAlerts = alerts.filter((a) => !a.resolved).length;

  const tabs = [
    { id: "map" as const, label: "Live Map", icon: Map },
    { id: "alerts" as const, label: "Alerts", icon: Bell, badge: activeAlerts },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
  ];

  return (
    <header
      className="h-14 shrink-0 flex items-center justify-between px-5 relative z-10"
      style={{
        background: "rgba(10,22,40,0.95)",
        borderBottom: "1px solid #1e3254",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div
          className="relative w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}
        >
          <Truck size={15} style={{ color: "#22d3ee" }} />
          <span
            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{ background: "#34d399", border: "2px solid #0a1628" }}
          />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight leading-none">FleetGuard</h1>
          <div className="flex items-center gap-1 mt-0.5">
            <Radio size={8} style={{ color: liveMode ? "#34d399" : "#94a3b8" }} className="pulse-dot" />
            <span className="text-[10px] font-medium tracking-widest uppercase" style={{ color: liveMode ? "#34d399" : "#94a3b8" }}>
              {liveMode ? "Live API" : "Demo"}
            </span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <nav
        className="flex items-center gap-1 p-1 rounded-xl"
        style={{ background: "rgba(2,13,24,0.7)", border: "1px solid #1e3254" }}
      >
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
            style={
              activeTab === id
                ? {
                    background: "rgba(34,211,238,0.08)",
                    border: "1px solid rgba(34,211,238,0.2)",
                    color: "#67e8f9",
                    boxShadow: "0 0 12px rgba(34,211,238,0.1)",
                  }
                : {
                    background: "transparent",
                    border: "1px solid transparent",
                    color: "#64748b",
                  }
            }
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
            {badge !== undefined && badge > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] text-[10px] text-white rounded-full flex items-center justify-center font-bold px-1"
                style={{ background: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.5)" }}
              >
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full pulse-dot" style={{ background: "#22d3ee" }} />
            <span className="font-data" style={{ color: "#64748b" }}>
              {stats.activeVehicles}/{stats.totalVehicles}{" "}
              <span style={{ color: "#334155" }}>active</span>
            </span>
          </div>
          {activeAlerts > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#f87171" }} />
              <span className="font-data font-medium" style={{ color: "#f87171" }}>
                {activeAlerts} alerts
              </span>
            </div>
          )}
          <span className="font-data" style={{ color: "#334155" }}>
            ₦{(stats.estimatedLossNaira / 1000).toFixed(0)}k{" "}
            <span style={{ color: "#1e293b" }}>flagged</span>
          </span>
        </div>

        <div className="w-px h-5" style={{ background: "#1e3254" }} />

        <Link
          href="/analyze"
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: "#64748b" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#22d3ee")}
          onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}
        >
          Analyze Logs
          <ExternalLink size={11} />
        </Link>
      </div>
    </header>
  );
}