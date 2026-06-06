import { FleetProvider } from "@/lib/fleetStore";
import Dashboard from "@/components/layout/Dashboard";

export default function Home() {
  return (
    <FleetProvider>
      <Dashboard />
    </FleetProvider>
  );
}
