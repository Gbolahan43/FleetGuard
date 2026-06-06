export type VehicleStatus = "on-route" | "idle" | "alert" | "offline";
export type AlertType = "fuel-theft" | "route-deviation" | "unauthorized-stop" | "speeding" | "idle-excess";
export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number;
  fuelLevel: number;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  vehicleType: "truck" | "van" | "motorcycle";
  status: VehicleStatus;
  currentPosition: GpsPoint;
  routeHistory: GpsPoint[];
  plannedRoute: [number, number][];
  fuelCapacity: number;
  currentFuel: number;
  totalDistance: number;
  todayDistance: number;
  alerts: Alert[];
  assignedZone: string;
}

export interface Alert {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  driverName: string;
  type: AlertType;
  severity: AlertSeverity;
  timestamp: number;
  location: { lat: number; lng: number };
  description: string;
  aiAnalysis?: string;
  fuelLost?: number;
  deviationKm?: number;
  stopDurationMin?: number;
  resolved: boolean;
}

export interface FleetStats {
  totalVehicles: number;
  activeVehicles: number;
  alertsToday: number;
  fuelTheftLiters: number;
  estimatedLossNaira: number;
  routeCompliancePercent: number;
  avgFuelEfficiency: number;
}
