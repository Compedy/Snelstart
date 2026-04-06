import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

async function logWebhook(
  method: string,
  request: NextRequest,
  body: unknown,
  status: number
) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Sla geen authorization headers op
    if (key.toLowerCase() !== "authorization") headers[key] = value;
  });

  await supabase.from("webhook_logs").insert({
    method,
    headers,
    body,
    response_status: status,
  });
}

export async function GET(request: NextRequest) {
  await logWebhook("GET", request, null, 200);
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(request: NextRequest) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // Geen JSON body — prima
  }

  await logWebhook("POST", request, body, 200);
  return NextResponse.json({ ok: true }, { status: 200 });
}
