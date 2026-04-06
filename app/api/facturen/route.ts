import { NextRequest, NextResponse } from "next/server";
import { maakVerkoopfactuur, VerkoopfactuurPayload } from "@/lib/snelstart";
import { zoekProjectOpApiKey } from "@/lib/projects";
import { supabase } from "@/lib/supabase";

async function logAanroep(entry: {
  project_id: string;
  project_naam: string;
  factuurnummer: string | null;
  request_body: unknown;
  response_status: number;
  response_body: unknown;
  error: string | null;
  duration_ms: number;
}) {
  await supabase.from("factuur_logs").insert(entry);
}

export async function POST(request: NextRequest) {
  const start = Date.now();

  // Authenticatie
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Authorization header ontbreekt" },
      { status: 401 }
    );
  }

  let project: Awaited<ReturnType<typeof zoekProjectOpApiKey>>;
  try {
    project = await zoekProjectOpApiKey(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (!project) {
    return NextResponse.json({ error: "Onbekende API key" }, { status: 403 });
  }

  let body: VerkoopfactuurPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  if (
    !body.klant?.id ||
    !body.factuurnummer ||
    !body.factuurbedrag ||
    !body.boekingsregels?.length
  ) {
    return NextResponse.json(
      {
        error:
          "Verplichte velden ontbreken: klant.id, factuurnummer, factuurbedrag, boekingsregels",
      },
      { status: 400 }
    );
  }

  try {
    const factuur = await maakVerkoopfactuur(project.snelstartClientKey, body);

    await logAanroep({
      project_id: project.id,
      project_naam: project.naam,
      factuurnummer: body.factuurnummer,
      request_body: body,
      response_status: 201,
      response_body: factuur,
      error: null,
      duration_ms: Date.now() - start,
    });

    return NextResponse.json(factuur, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";

    await logAanroep({
      project_id: project.id,
      project_naam: project.naam,
      factuurnummer: body.factuurnummer ?? null,
      request_body: body,
      response_status: 502,
      response_body: null,
      error: message,
      duration_ms: Date.now() - start,
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
