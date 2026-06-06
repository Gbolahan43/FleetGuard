import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

function buildPrompt(alert: Record<string, unknown>, vehicleHistory?: string): string {
  return `You are FleetGuard AI, an intelligent fleet monitoring system for a Nigerian logistics company.

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
}

export async function POST(req: NextRequest) {
  const { alert, vehicleHistory } = await req.json();

  if (!alert) {
    return NextResponse.json({ analysis: "No alert data provided." }, { status: 400 });
  }

  const region = process.env.AWS_REGION || "us-west-2";
  const modelId =
    process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-opus-4-6-v1";
  const prompt = buildPrompt(alert, vehicleHistory);

  try {
    const client = new BedrockRuntimeClient({ region });
    const body = JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const response = await client.send(
      new InvokeModelCommand({
        modelId,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(body),
      })
    );

    const decoded = JSON.parse(new TextDecoder().decode(response.body));
    const text =
      decoded.content?.[0]?.text ||
      decoded.output?.message?.content?.[0]?.text ||
      "Analysis unavailable.";

    return NextResponse.json({ analysis: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bedrock invoke failed";
    console.error("Bedrock analyze error:", message);
    return NextResponse.json(
      { analysis: "AI analysis temporarily unavailable." },
      { status: 500 }
    );
  }
}
