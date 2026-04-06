import { NextRequest, NextResponse } from "next/server";
import { zoekProjectOpApiKey } from "@/lib/projects";
import { lijstRelaties } from "@/lib/snelstart";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Authorization header ontbreekt" },
      { status: 401 }
    );
  }

  const project = await zoekProjectOpApiKey(apiKey).catch(() => null);
  if (!project) {
    return NextResponse.json({ error: "Onbekende API key" }, { status: 403 });
  }

  try {
    const relaties = await lijstRelaties(project.snelstartClientKey);
    return NextResponse.json(relaties);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
