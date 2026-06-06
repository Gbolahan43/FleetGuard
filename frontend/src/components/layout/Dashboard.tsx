"use client";
import dynamic from "next/dynamic";
import { useFleet } from "@/lib/fleetStore";
import TopBar from "@/components/layout/TopBar";
import VehicleList from "@/components/layout/VehicleList";
import AlertsPanel from "@/components/alerts/AlertsPanel";
import AnalyticsPanel from "@/components/charts/AnalyticsPanel";
import StatCard from "@/components/ui/StatCard";
import VehiclePanel from "@/components/map/VehiclePanel";
import { Truck, AlertTriangle, Fuel, TrendingDown, Shield } from "lucide-react";

const FleetMap = dynamic(() => import("@/components/map/FleetMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center rounded-xl" style={{ background: "#020d18" }}>
      <div className="text-center">
        <div className="w-8 h-8 border border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs tracking-wider" style={{ color: "#475569" }}>Initialising map…</p>
      </div>
    </div>
  ),
});

export default function Dashboard() {
  const { stats, activeTab } = useFleet();

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#020d18" }}>
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.018) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      <TopBar />

      {/* Stats bar */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-2 px-4 py-3 shrink-0">
        <StatCard
          label="Active Vehicles"
          value={`${stats.activeVehicles}/${stats.totalVehicles}`}
          icon={Truck}
          sub="2 on route, 1 idle"
        />
        <StatCard
          label="Alerts Today"
          value={stats.alertsToday}
          icon={AlertTriangle}
          variant="danger"
          pulse={stats.alertsToday > 0}
          sub="2 unresolved"
        />
        <StatCard
          label="Fuel Theft"
          value={`${stats.fuelTheftLiters}L`}
          icon={Fuel}
          variant="warning"
          sub="Suspected today"
        />
        <StatCard
          label="Est. Loss"
          value={`₦${(stats.estimatedLossNaira / 1000).toFixed(0)}k`}
          icon={TrendingDown}
          variant="danger"
          sub="This month"
        />
        <StatCard
          label="Route Compliance"
          value={`${stats.routeCompliancePercent}%`}
          icon={Shield}
          variant={stats.routeCompliancePercent > 85 ? "success" : "warning"}
          sub="Fleet average"
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 overflow-hidden gap-2 px-4 pb-4">
        {/* Left sidebar */}
        <div
          className="w-52 shrink-0 rounded-xl overflow-hidden"
          style={{ border: "1px solid #1e3254", boxShadow: "0 0 30px rgba(0,0,0,0.5)" }}
        >
          <VehicleList />
        </div>

        {/* Center panel */}
        <div
          className="flex-1 relative overflow-hidden rounded-xl"
          style={{ border: "1px solid #1e3254", boxShadow: "0 0 30px rgba(0,0,0,0.5)" }}
        >
          {activeTab === "map" && (
            <div className="relative w-full h-full">
              <FleetMap />
              <VehiclePanel />
            </div>
          )}
          {activeTab === "alerts" && (
            <div className="h-full overflow-hidden animate-fade-up" style={{ background: "#0a1628" }}>
              <AlertsPanel />
            </div>
          )}
          {activeTab === "analytics" && (
            <div className="h-full overflow-hidden animate-fade-up" style={{ background: "#0a1628" }}>
              <AnalyticsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}