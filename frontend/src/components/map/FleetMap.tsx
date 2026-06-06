"use client";
import { useEffect, useRef } from "react";
import { useFleet } from "@/lib/fleetStore";
import type { Vehicle } from "@/types/fleet";

const statusColors: Record<string, string> = {
  "on-route": "#22d3ee",
  idle: "#94a3b8",
  alert: "#f87171",
  offline: "#475569",
};

const statusGlow: Record<string, string> = {
  "on-route": "0 0 12px #22d3ee88",
  idle: "0 0 8px #94a3b844",
  alert: "0 0 14px #f8717188",
  offline: "none",
};

export default function FleetMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<unknown>(null);
  const markersRef = useRef<Record<string, unknown>>({});
  const routeLinesRef = useRef<Record<string, unknown>>({});
  const { vehicles, selectedVehicle, setSelectedVehicle, setSelectedAlert, alerts } =
    useFleet();

  useEffect(() => {
    if (typeof window === "undefined" || mapInstanceRef.current) return;

    // Dynamic import for SSR safety
    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      // Fix default icon
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current, {
        center: [6.5244, 3.3792],
        zoom: 12,
        zoomControl: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "© CartoDB",
          maxZoom: 19,
        }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      mapInstanceRef.current = map;

      // Draw initial vehicles
      vehicles.forEach((v) => drawVehicle(L, map, v));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when vehicles change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      const map = mapInstanceRef.current as ReturnType<typeof L.map>;
      vehicles.forEach((v) => updateVehicleMarker(L, map, v));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  // Pan to selected vehicle
  useEffect(() => {
    if (!selectedVehicle || !mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      const map = mapInstanceRef.current as ReturnType<typeof L.map>;
      map.flyTo(
        [selectedVehicle.currentPosition.lat, selectedVehicle.currentPosition.lng],
        14,
        { duration: 1.2 }
      );
    });
  }, [selectedVehicle]);

  function drawVehicle(L: typeof import("leaflet"), map: ReturnType<typeof L.map>, v: Vehicle) {
    const color = statusColors[v.status];
    const vehicleAlert = alerts.find((a) => a.vehicleId === v.id && !a.resolved);

    // Custom icon
    const icon = L.divIcon({
      className: "",
      html: `
        <div style="position:relative;width:36px;height:36px;">
          ${v.status === "alert" ? `<div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.25;animation:ping 1.5s infinite;"></div>` : ""}
          <div style="
            position:absolute;inset:4px;
            background:${color};
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:13px;
            box-shadow:${statusGlow[v.status]};
            border:2px solid ${v.status === 'alert' ? '#fca5a5' : color};
          ">${v.vehicleType === "truck" ? "🚛" : v.vehicleType === "motorcycle" ? "🏍" : "🚐"}</div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const marker = L.marker([v.currentPosition.lat, v.currentPosition.lng], { icon });
    marker.addTo(map);
    marker.on("click", () => {
      setSelectedVehicle(v);
      if (vehicleAlert) setSelectedAlert(vehicleAlert);
    });

    markersRef.current[v.id] = marker;

    // Route history polyline
    if (v.routeHistory.length > 1) {
      const latLngs = v.routeHistory.map((p) => [p.lat, p.lng] as [number, number]);
      const line = L.polyline(latLngs, {
        color: color,
        weight: 2,
        opacity: 0.5,
        dashArray: v.status === "alert" ? "6,4" : undefined,
      }).addTo(map);
      routeLinesRef.current[v.id] = line;
    }

    // Planned route (thinner, dashed)
    if (v.plannedRoute.length > 1) {
      L.polyline(v.plannedRoute, {
        color: "#64748b",
        weight: 1.5,
        opacity: 0.4,
        dashArray: "4,6",
      }).addTo(map);
    }
  }

  function updateVehicleMarker(L: typeof import("leaflet"), map: ReturnType<typeof L.map>, v: Vehicle) {
    const existing = markersRef.current[v.id] as ReturnType<typeof L.marker> | undefined;
    if (existing) {
      existing.setLatLng([v.currentPosition.lat, v.currentPosition.lng]);
    } else {
      drawVehicle(L, map, v);
    }
  }

  return (
    <div className="relative w-full h-full">
      <style>{`
        @keyframes ping {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.8); opacity: 0; }
        }
        .leaflet-container { background: #0f172a; }
      `}</style>
      <div ref={mapRef} className="w-full h-full rounded-xl" />
      {/* Legend */}
      <div className="absolute bottom-8 left-4 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-lg p-3 text-xs space-y-1.5">
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: color }}
            />
            <span className="text-slate-400 capitalize">{status.replace("-", " ")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
