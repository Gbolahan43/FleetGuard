"use client";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useFleet } from "@/lib/fleetStore";
import { fuelTrendData, alertsTrendData } from "@/data/mockData";

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (active && payload?.length) {
    return (
      <div className="bg-slate-800 border border-slate-700/50 rounded-lg p-3 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: {p.value}
            {p.name.includes("Naira") ? "₦" : ""}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPanel() {
  const { vehicles, stats } = useFleet();

  const vehicleFuelData = vehicles.map((v) => ({
    name: v.plateNumber.split("-")[1],
    fuel: Math.round(v.currentFuel),
    capacity: v.fuelCapacity,
    efficiency: v.vehicleType === "motorcycle" ? 35 : v.vehicleType === "van" ? 12 : 8,
  }));

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-6">
      <div>
        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          Fuel Consumption vs Theft — Today
        </h3>
        <div className="bg-slate-800/30 rounded-xl p-3">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={fuelTrendData}>
              <defs>
                <linearGradient id="colorConsumed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTheft" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
              />
              <Area
                type="monotone"
                dataKey="consumed"
                name="Consumed (L)"
                stroke="#22d3ee"
                strokeWidth={2}
                fill="url(#colorConsumed)"
              />
              <Area
                type="monotone"
                dataKey="theft"
                name="Suspected Theft (L)"
                stroke="#f87171"
                strokeWidth={2}
                fill="url(#colorTheft)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          Alerts by Severity — Last 7 Days
        </h3>
        <div className="bg-slate-800/30 rounded-xl p-3">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={alertsTrendData} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar dataKey="critical" name="Critical" fill="#f87171" radius={[2, 2, 0, 0]} />
              <Bar dataKey="high" name="High" fill="#fb923c" radius={[2, 2, 0, 0]} />
              <Bar dataKey="medium" name="Medium" fill="#fbbf24" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          Vehicle Fuel Levels
        </h3>
        <div className="space-y-2">
          {vehicleFuelData.map((v) => (
            <div key={v.name} className="bg-slate-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-slate-300">{v.name}</span>
                <span
                  className={`text-xs font-bold ${
                    v.fuel < 20
                      ? "text-red-400"
                      : v.fuel < 40
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}
                >
                  {v.fuel}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    v.fuel < 20
                      ? "bg-red-500"
                      : v.fuel < 40
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${v.fuel}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4">
        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          Financial Impact
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Fuel theft losses</span>
            <span className="text-sm font-bold text-red-400">
              ₦{stats.estimatedLossNaira.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Suspected theft (L)</span>
            <span className="text-sm font-bold text-amber-400">
              {stats.fuelTheftLiters}L
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Route compliance</span>
            <span className="text-sm font-bold text-cyan-400">
              {stats.routeCompliancePercent}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400">Avg fuel efficiency</span>
            <span className="text-sm font-bold text-white">
              {stats.avgFuelEfficiency} km/L
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
