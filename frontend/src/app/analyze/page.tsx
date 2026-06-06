"use client";
import { useState, useCallback, useRef } from "react";
import {
  Upload, FileText, AlertTriangle, CheckCircle,
  TrendingDown, Fuel, Route, Clock, ChevronDown, ChevronUp,
  BarChart2, ArrowLeft, Loader2, Truck, Brain,
} from "lucide-react";
import Link from "next/link";

interface ScoredRow {
  trip_id?: string;
  vehicle_id?: string;
  driver_id?: string;
  anomaly_score: number;
  is_anomaly: boolean | number;
  anomaly_type?: string;
  fuel_consumed?: number;
  distance_km?: number;
  idle_minutes?: number;
  [key: string]: unknown;
}

interface AnalyzeResponse {
  total_records: number;
  anomalies_detected: number;
  anomaly_rate: number;
  top_anomalies: ScoredRow[];
  summary: {
    fuel_theft_suspected: number;
    route_deviations: number;
    excessive_idle: number;
    estimated_loss_naira: number;
  };
  ai_insight?: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8080";

function scoreColor(score: number) {
  if (score > 0.7) return { text: "text-red-400", bar: "bg-red-500", bg: "bg-red-500/5 border-red-900/40" };
  if (score > 0.4) return { text: "text-amber-400", bar: "bg-amber-500", bg: "bg-amber-500/5 border-amber-900/40" };
  return { text: "text-emerald-400", bar: "bg-emerald-500", bg: "bg-emerald-500/5 border-emerald-900/40" };
}

function SummaryCard({ label, value, sub, icon: Icon, variant = "default" }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; variant?: "default" | "danger" | "warning" | "success";
}) {
  const cfg = {
    default: { bg: "bg-[#0a1628] border-[#1e3254]", icon: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", value: "text-white", accent: "via-cyan-500/30" },
    danger:  { bg: "bg-[#0a1628] border-red-900/40", icon: "text-red-400 bg-red-500/10 border-red-500/20", value: "text-red-300", accent: "via-red-500/30" },
    warning: { bg: "bg-[#0a1628] border-amber-900/40", icon: "text-amber-400 bg-amber-500/10 border-amber-500/20", value: "text-amber-300", accent: "via-amber-500/30" },
    success: { bg: "bg-[#0a1628] border-emerald-900/40", icon: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", value: "text-emerald-300", accent: "via-emerald-500/30" },
  }[variant];

  return (
    <div className={`relative rounded-xl border p-5 overflow-hidden ${cfg.bg}`}>
      <div className={`absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent ${cfg.accent} to-transparent`} />
      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center mb-3 ${cfg.icon}`}>
        <Icon size={15} />
      </div>
      <p className={`text-2xl font-bold font-data leading-none ${cfg.value}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1.5 font-medium">{label}</p>
      {sub && <p className="text-[10px] text-slate-700 mt-0.5">{sub}</p>}
    </div>
  );
}

function AnomalyRow({ row, idx }: { row: ScoredRow; idx: number }) {
  const [open, setOpen] = useState(false);
  const score = row.anomaly_score ?? 0;
  const c = scoreColor(score);
  const plate = row.vehicle_id ?? row.trip_id ?? `Row ${idx + 1}`;
  const driver = row.driver_id ?? "—";
  const type = row.anomaly_type ?? (row.is_anomaly ? "Anomaly" : "Normal");
  const pct = Math.round(score * 100);

  const extraFields = Object.entries(row).filter(
    ([k]) => !["anomaly_score","is_anomaly","anomaly_type","vehicle_id","trip_id","driver_id"].includes(k)
  );

  return (
    <div className={`border rounded-xl overflow-hidden ${c.bg} transition-all duration-200`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-white/3 transition-colors"
      >
        <span className="text-[10px] text-slate-700 font-data w-5 shrink-0">{idx + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white truncate leading-none">{plate}</p>
          <p className="text-[10px] text-slate-500 mt-0.5">{driver} · <span className="text-slate-600">{type}</span></p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-20 h-1.5 bg-[#0f1f35] rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={`text-xs font-data font-bold w-8 text-right ${c.text}`}>{pct}%</span>
        </div>
        {open
          ? <ChevronUp size={13} className="text-slate-600 shrink-0" />
          : <ChevronDown size={13} className="text-slate-600 shrink-0" />
        }
      </button>

      {open && extraFields.length > 0 && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-[#1e3254]/40">
          {extraFields.map(([k, v]) => (
            <div key={k} className="bg-[#0f1f35]/60 rounded-lg p-2.5">
              <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-0.5 capitalize">
                {k.replace(/_/g, " ")}
              </p>
              <p className="text-xs text-slate-300 font-data font-medium truncate">{String(v ?? "—")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) { setError("Please upload a .csv file."); return; }
    setFile(f); setError(null); setResult(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  async function analyze() {
    if (!file) return;
    setLoading(true); setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BACKEND}/api/v1/analyze-fleet`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.text()) || `Server error ${res.status}`);
      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach backend. Is it running on port 8080?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#020d18] text-white relative">
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,211,238,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,211,238,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 h-14 border-b border-[#1e3254] bg-[#0a1628]/90 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/live"
            className="flex items-center gap-1.5 text-slate-500 hover:text-white transition-colors text-xs font-medium"
          >
            <ArrowLeft size={13} />
            Live Monitor
          </Link>
          <div className="w-px h-4 bg-[#1e3254]" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <BarChart2 size={12} className="text-cyan-400" />
            </div>
            <span className="text-sm font-semibold text-white">Analyze Logs</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
          <span className="text-[10px] text-slate-500 font-medium">Backend connected · port 8080</span>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-10">
        {/* Page title */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Truck size={14} className="text-cyan-500" />
            <span className="text-[10px] text-cyan-500 font-bold uppercase tracking-[0.2em]">FleetGuard ML</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Fleet Log Analysis</h1>
          <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
            Upload a trip telemetry CSV. The IsolationForest model (F1 = 0.994) scores every row for anomalies.
          </p>
        </div>

        {/* Upload zone */}
        {!result && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-300 overflow-hidden ${
              dragging
                ? "border-cyan-500 bg-cyan-500/5"
                : file
                ? "border-emerald-600/50 bg-emerald-500/3"
                : "border-[#1e3254] hover:border-[#2d4a6e] bg-[#0a1628]/50 hover:bg-[#0a1628]/80"
            }`}
          >
            {/* Background glow when dragging */}
            {dragging && (
              <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
            )}

            <input ref={inputRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

            {file ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <FileText size={22} className="text-emerald-400" />
                </div>
                <p className="text-white font-semibold text-base">{file.name}</p>
                <p className="text-slate-500 text-sm mt-1">
                  {(file.size / 1024).toFixed(1)} KB · Ready to analyze
                </p>
                <p className="text-slate-700 text-xs mt-3">Click to change file</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-[#0f1f35] border border-[#1e3254] flex items-center justify-center mx-auto mb-4">
                  <Upload size={20} className="text-slate-500" />
                </div>
                <p className="text-slate-300 font-semibold">Drop your telemetry CSV here</p>
                <p className="text-slate-600 text-sm mt-1">or click to browse files</p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-slate-700 bg-[#0f1f35] border border-[#1e3254] rounded-lg px-3 py-1.5">
                  <FileText size={11} />
                  ml/data/mock/fleetguard_telemetry.csv
                </div>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-start gap-3 bg-red-500/5 border border-red-900/50 rounded-xl p-4 animate-fade-up">
            <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={13} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm text-red-300 font-semibold">Analysis failed</p>
              <p className="text-xs text-red-500/80 mt-0.5 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* Run button */}
        {file && !result && (
          <button
            onClick={analyze}
            disabled={loading}
            className="mt-5 w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 relative overflow-hidden group
              bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed
              shadow-[0_0_30px_rgba(34,211,238,0.15)] hover:shadow-[0_0_40px_rgba(34,211,238,0.25)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running IsolationForest model…
              </>
            ) : (
              <>
                <BarChart2 size={16} />
                Run Anomaly Detection
              </>
            )}
          </button>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-fade-up">
            {/* Result header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Analysis Results</h2>
                <p className="text-xs text-slate-600 mt-0.5 font-data">{file?.name}</p>
              </div>
              <button
                onClick={() => { setResult(null); setFile(null); }}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white border border-[#1e3254] hover:border-[#2d4a6e] rounded-lg px-3 py-2 transition-all"
              >
                <Upload size={12} />
                New file
              </button>
            </div>

            {/* Anomaly rate banner */}
            <div className={`rounded-xl border p-4 flex items-center gap-4 ${
              result.anomaly_rate > 0.1
                ? "bg-red-500/5 border-red-900/40"
                : "bg-emerald-500/5 border-emerald-900/40"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                result.anomaly_rate > 0.1 ? "bg-red-500/10 border border-red-500/20" : "bg-emerald-500/10 border border-emerald-500/20"
              }`}>
                {result.anomaly_rate > 0.1
                  ? <AlertTriangle size={18} className="text-red-400" />
                  : <CheckCircle size={18} className="text-emerald-400" />
                }
              </div>
              <div>
                <p className={`text-sm font-semibold ${result.anomaly_rate > 0.1 ? "text-red-300" : "text-emerald-300"}`}>
                  {(result.anomaly_rate * 100).toFixed(1)}% anomaly rate detected
                </p>
                <p className="text-xs text-slate-500">
                  {result.anomalies_detected} of {result.total_records.toLocaleString()} trips flagged by the ML model
                </p>
              </div>
              <div className="ml-auto">
                <div className="w-32 h-2 bg-[#0f1f35] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${result.anomaly_rate > 0.1 ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(result.anomaly_rate * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCard label="Total Records" value={result.total_records.toLocaleString()} icon={FileText} sub="rows processed" />
              <SummaryCard label="Anomalies Found" value={result.anomalies_detected} icon={AlertTriangle} variant="danger" sub="flagged trips" />
              <SummaryCard label="Est. Financial Loss" value={`₦${(result.summary.estimated_loss_naira / 1000).toFixed(0)}k`} icon={TrendingDown} variant="warning" sub="from anomalies" />
              <SummaryCard label="Route Deviations" value={result.summary.route_deviations} icon={Route} variant={result.summary.route_deviations > 0 ? "warning" : "success"} sub="off-route trips" />
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Fuel, color: "text-red-400 bg-red-500/10 border-red-500/20", label: "Fuel Theft Suspected", value: `${result.summary.fuel_theft_suspected} trips`, vColor: "text-red-400" },
                { icon: Clock, color: "text-amber-400 bg-amber-500/10 border-amber-500/20", label: "Excessive Idle", value: `${result.summary.excessive_idle} trips`, vColor: "text-amber-400" },
                { icon: CheckCircle, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Clean Trips", value: `${result.total_records - result.anomalies_detected}`, vColor: "text-emerald-400" },
              ].map(({ icon: Icon, color, label, value, vColor }) => (
                <div key={label} className="bg-[#0a1628] border border-[#1e3254] rounded-xl p-4 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${color}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-600 leading-none">{label}</p>
                    <p className={`text-sm font-bold font-data mt-1 ${vColor}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* AI Insight */}
            {result.ai_insight && (
              <div className="bg-cyan-500/3 border border-cyan-900/40 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-cyan-900/30">
                  <div className="w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Brain size={12} className="text-cyan-400" />
                  </div>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.15em]">AI Insight</span>
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 pulse-dot" />
                </div>
                <p className="text-sm text-slate-400 leading-relaxed p-4">{result.ai_insight}</p>
              </div>
            )}

            {/* Anomaly list */}
            {result.top_anomalies?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.15em]">
                    Top Anomalies
                  </p>
                  <div className="flex-1 h-px bg-[#1e3254]" />
                  <span className="text-[10px] text-slate-600 font-data">{result.top_anomalies.length} shown</span>
                </div>
                <div className="space-y-2">
                  {result.top_anomalies.map((row, i) => (
                    <AnomalyRow key={i} row={row} idx={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}