import type { Vehicle, Alert, GpsPoint, FleetStats } from "@/types/fleet";

const LAGOS_CENTER = { lat: 6.5244, lng: 3.3792 };

function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range;
}

function generateRouteHistory(
  startLat: number,
  startLng: number,
  points: number,
  direction: "north" | "east" | "south" | "west"
): GpsPoint[] {
  const history: GpsPoint[] = [];
  let lat = startLat;
  let lng = startLng;
  let fuel = 75 + Math.random() * 20;
  const now = Date.now();

  const dirMap = {
    north: [0.002, 0.001],
    east: [0.001, 0.003],
    south: [-0.002, 0.001],
    west: [0.001, -0.003],
  };

  for (let i = 0; i < points; i++) {
    lat += dirMap[direction][0] + (Math.random() - 0.5) * 0.001;
    lng += dirMap[direction][1] + (Math.random() - 0.5) * 0.001;
    fuel -= 0.3 + Math.random() * 0.2;
    history.push({
      lat,
      lng,
      timestamp: now - (points - i) * 60000,
      speed: 20 + Math.random() * 50,
      fuelLevel: Math.max(10, fuel),
    });
  }
  return history;
}

function generateDeviatedRoute(
  startLat: number,
  startLng: number
): GpsPoint[] {
  const history = generateRouteHistory(startLat, startLng, 15, "east");
  // Insert deviation
  const deviationPoint: GpsPoint = {
    lat: history[8].lat + 0.03,
    lng: history[8].lng - 0.02,
    timestamp: history[8].timestamp + 180000,
    speed: 5,
    fuelLevel: history[8].fuelLevel - 15, // big fuel drop
  };
  history.splice(9, 0, deviationPoint);
  return history;
}

export const mockVehicles: Vehicle[] = [
  {
    id: "v1",
    plateNumber: "LND-234-AA",
    driverName: "Emeka Okafor",
    driverPhone: "+234 803 456 7890",
    vehicleType: "truck",
    status: "on-route",
    currentPosition: {
      lat: jitter(LAGOS_CENTER.lat + 0.05, 0.01),
      lng: jitter(LAGOS_CENTER.lng + 0.04, 0.01),
      timestamp: Date.now(),
      speed: 42,
      fuelLevel: 68,
    },
    routeHistory: generateRouteHistory(
      LAGOS_CENTER.lat,
      LAGOS_CENTER.lng,
      20,
      "east"
    ),
    plannedRoute: [
      [6.5244, 3.3792],
      [6.5300, 3.3900],
      [6.5350, 3.4100],
      [6.5400, 3.4300],
    ],
    fuelCapacity: 100,
    currentFuel: 68,
    totalDistance: 24500,
    todayDistance: 87,
    alerts: [],
    assignedZone: "Lagos Island",
  },
  {
    id: "v2",
    plateNumber: "LND-891-BC",
    driverName: "Tunde Adeyemi",
    driverPhone: "+234 806 123 4567",
    vehicleType: "van",
    status: "alert",
    currentPosition: {
      lat: jitter(LAGOS_CENTER.lat - 0.02, 0.01),
      lng: jitter(LAGOS_CENTER.lng + 0.07, 0.01),
      timestamp: Date.now(),
      speed: 3,
      fuelLevel: 31,
    },
    routeHistory: generateDeviatedRoute(
      LAGOS_CENTER.lat - 0.05,
      LAGOS_CENTER.lng + 0.02
    ),
    plannedRoute: [
      [6.5044, 3.3992],
      [6.5100, 3.4100],
      [6.5150, 3.4300],
      [6.5200, 3.4500],
    ],
    fuelCapacity: 80,
    currentFuel: 31,
    totalDistance: 18900,
    todayDistance: 52,
    alerts: [],
    assignedZone: "Victoria Island",
  },
  {
    id: "v3",
    plateNumber: "LND-567-CD",
    driverName: "Chioma Nwosu",
    driverPhone: "+234 809 876 5432",
    vehicleType: "van",
    status: "idle",
    currentPosition: {
      lat: jitter(LAGOS_CENTER.lat + 0.08, 0.01),
      lng: jitter(LAGOS_CENTER.lng - 0.03, 0.01),
      timestamp: Date.now(),
      speed: 0,
      fuelLevel: 82,
    },
    routeHistory: generateRouteHistory(
      LAGOS_CENTER.lat + 0.04,
      LAGOS_CENTER.lng - 0.06,
      12,
      "north"
    ),
    plannedRoute: [
      [6.5644, 3.3492],
      [6.5700, 3.3600],
      [6.5750, 3.3700],
    ],
    fuelCapacity: 80,
    currentFuel: 82,
    totalDistance: 11200,
    todayDistance: 34,
    alerts: [],
    assignedZone: "Ikeja",
  },
  {
    id: "v4",
    plateNumber: "LND-002-EF",
    driverName: "Babajide Fashola",
    driverPhone: "+234 802 345 6789",
    vehicleType: "motorcycle",
    status: "on-route",
    currentPosition: {
      lat: jitter(LAGOS_CENTER.lat - 0.04, 0.01),
      lng: jitter(LAGOS_CENTER.lng - 0.05, 0.01),
      timestamp: Date.now(),
      speed: 35,
      fuelLevel: 55,
    },
    routeHistory: generateRouteHistory(
      LAGOS_CENTER.lat - 0.07,
      LAGOS_CENTER.lng - 0.08,
      18,
      "north"
    ),
    plannedRoute: [
      [6.4844, 3.3292],
      [6.4900, 3.3400],
      [6.5000, 3.3600],
    ],
    fuelCapacity: 20,
    currentFuel: 55,
    totalDistance: 8700,
    todayDistance: 63,
    alerts: [],
    assignedZone: "Surulere",
  },
  {
    id: "v5",
    plateNumber: "LND-445-GH",
    driverName: "Ngozi Ibe",
    driverPhone: "+234 807 654 3210",
    vehicleType: "truck",
    status: "offline",
    currentPosition: {
      lat: jitter(LAGOS_CENTER.lat + 0.12, 0.01),
      lng: jitter(LAGOS_CENTER.lng + 0.10, 0.01),
      timestamp: Date.now() - 3600000,
      speed: 0,
      fuelLevel: 12,
    },
    routeHistory: generateRouteHistory(
      LAGOS_CENTER.lat + 0.09,
      LAGOS_CENTER.lng + 0.07,
      8,
      "east"
    ),
    plannedRoute: [
      [6.6044, 3.4592],
      [6.6100, 3.4700],
    ],
    fuelCapacity: 100,
    currentFuel: 12,
    totalDistance: 31000,
    todayDistance: 0,
    alerts: [],
    assignedZone: "Lekki",
  },
];

export const mockAlerts: Alert[] = [
  {
    id: "a1",
    vehicleId: "v2",
    vehiclePlate: "LND-891-BC",
    driverName: "Tunde Adeyemi",
    type: "fuel-theft",
    severity: "critical",
    timestamp: Date.now() - 2400000,
    location: { lat: 6.5044, lng: 3.4292 },
    description: "Rapid fuel drop of 15L detected during unauthorized stop",
    aiAnalysis:
      "Vehicle LND-891-BC stopped for 47 minutes at a non-approved location near Lekki Phase 1. Fuel level dropped 15L (18.75% of capacity) with engine off. Cross-referencing with driver behavior: 3rd incident this month. Estimated loss: ₦15,750. Recommend immediate driver review.",
    fuelLost: 15,
    deviationKm: 3.2,
    stopDurationMin: 47,
    resolved: false,
  },
  {
    id: "a2",
    vehicleId: "v2",
    vehiclePlate: "LND-891-BC",
    driverName: "Tunde Adeyemi",
    type: "route-deviation",
    severity: "high",
    timestamp: Date.now() - 2700000,
    location: { lat: 6.5300, lng: 3.4200 },
    description: "Vehicle deviated 3.2km from approved route",
    aiAnalysis:
      "Route deviation detected: Vehicle traveled 3.2km off the approved Lagos-VI corridor. The detour matches a known fuel black market location flagged in our database. Duration of deviation: 52 minutes. This pattern correlates with previous incidents on Tuesdays.",
    deviationKm: 3.2,
    stopDurationMin: 52,
    resolved: false,
  },
  {
    id: "a3",
    vehicleId: "v5",
    vehiclePlate: "LND-445-GH",
    driverName: "Ngozi Ibe",
    type: "idle-excess",
    severity: "medium",
    timestamp: Date.now() - 7200000,
    location: { lat: 6.6044, lng: 3.4592 },
    description: "Vehicle idle for 2+ hours, engine running",
    aiAnalysis:
      "LND-445-GH has been stationary with engine running for 2 hours 14 minutes. At current idle consumption of 2.1L/hr, estimated 4.7L wasted (₦4,935). Vehicle is also showing low fuel warning. Driver has not responded to app notifications.",
    fuelLost: 4.7,
    resolved: false,
  },
  {
    id: "a4",
    vehicleId: "v1",
    vehiclePlate: "LND-234-AA",
    driverName: "Emeka Okafor",
    type: "speeding",
    severity: "low",
    timestamp: Date.now() - 10800000,
    location: { lat: 6.5400, lng: 3.4300 },
    description: "Speed exceeded 80km/h on restricted road",
    aiAnalysis:
      "Vehicle briefly exceeded speed limit by 12km/h on restricted zone. Lasted 3 minutes. No other incidents today. Driver has a clean 30-day record prior to this event.",
    resolved: true,
  },
  {
    id: "a5",
    vehicleId: "v3",
    vehiclePlate: "LND-567-CD",
    driverName: "Chioma Nwosu",
    type: "unauthorized-stop",
    severity: "medium",
    timestamp: Date.now() - 14400000,
    location: { lat: 6.5700, lng: 3.3600 },
    description: "30-minute stop at non-approved location",
    aiAnalysis:
      "Vehicle made an unscheduled 30-minute stop. Location not in approved stop registry. No corresponding delivery logged. Fuel levels stable — no theft detected. May be a rest stop. First occurrence for this driver.",
    stopDurationMin: 30,
    resolved: true,
  },
];

// Attach alerts to vehicles
mockVehicles.forEach((v) => {
  v.alerts = mockAlerts.filter((a) => a.vehicleId === v.id);
});

export const mockStats: FleetStats = {
  totalVehicles: 5,
  activeVehicles: 3,
  alertsToday: 5,
  fuelTheftLiters: 19.7,
  estimatedLossNaira: 207350,
  routeCompliancePercent: 78,
  avgFuelEfficiency: 8.4,
};

export const fuelTrendData = [
  { time: "06:00", consumed: 8, theft: 0 },
  { time: "07:00", consumed: 14, theft: 0 },
  { time: "08:00", consumed: 18, theft: 0 },
  { time: "09:00", consumed: 22, theft: 15 },
  { time: "10:00", consumed: 26, theft: 15 },
  { time: "11:00", consumed: 31, theft: 15 },
  { time: "12:00", consumed: 36, theft: 20 },
  { time: "13:00", consumed: 41, theft: 20 },
  { time: "14:00", consumed: 46, theft: 20 },
  { time: "Now", consumed: 52, theft: 20 },
];

export const alertsTrendData = [
  { day: "Mon", critical: 1, high: 2, medium: 1 },
  { day: "Tue", critical: 2, high: 1, medium: 3 },
  { day: "Wed", critical: 0, high: 2, medium: 2 },
  { day: "Thu", critical: 1, high: 3, medium: 1 },
  { day: "Fri", critical: 2, high: 2, medium: 2 },
  { day: "Sat", critical: 1, high: 1, medium: 1 },
  { day: "Today", critical: 2, high: 1, medium: 2 },
];
