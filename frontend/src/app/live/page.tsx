"use client";
import { FleetProvider } from "@/lib/fleetStore";
import Dashboard from "@/components/layout/Dashboard";
 
export default function LivePage() {
  return (
    <FleetProvider>
      <Dashboard />
    </FleetProvider>
  );
}
 