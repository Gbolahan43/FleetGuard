import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { alert, vehicleHistory } = await req.json();

  const prompt = `You are FleetGuard AI, an intelligent fleet monitoring system for a Nigerian logistics company.

Analyze this fleet alert and provide a concise, actionable analysis in 3-4 sentences:

ALERT TYPE: ${alert.type}
VEHICLE: ${alert.vehiclePlate}
DRIVER: ${alert.driverName}  
DESCRIPTION: ${alert.description}
SEVERITY: ${alert.severity}
${alert.fuelLost ? `FUEL LOST: ${alert.fuelLost}L` : ""}
${alert.deviationKm ? `ROUTE DEVIATION: ${alert.deviationKm}km` : ""}
${alert.stopDurationMin ? `UNAUTHORIZED STOP: ${alert.stopDurationMin} minutes` : ""}
${vehicleHistory ? `RECENT ALERTS: ${vehicleHistory}` : ""}

Provide:
1. What likely happened (be specific)
2. Financial impact in Naira (use ₦1,050/L for fuel)
3. Recommended immediate action
4. Risk level for repeat occurrence

Be direct and professional. Use Nigerian context where relevant.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "Analysis unavailable.";
    return NextResponse.json({ analysis: text });
  } catch {
    return NextResponse.json(
      { analysis: "AI analysis temporarily unavailable." },
      { status: 500 }
    );
  }
}
