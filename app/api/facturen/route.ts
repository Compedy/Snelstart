import { NextRequest, NextResponse } from "next/server";
import { maakVerkoopfactuur, VerkoopfactuurPayload } from "@/lib/snelstart";
import { zoekProjectOpApiKey } from "@/lib/projects";
import { checkRateLimit } from "@/lib/ratelimit";
import { supabase } from "@/lib/supabase";

const ENDPOINT = "/api/facturen";

function getIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  );
}

async function logAccess(
  request: NextRequest,
  status: number,
  error: string
) {
  await supabase.from("access_logs").insert({
    endpoint: ENDPOINT,
    response_status: status,
    error,
    ip: getIp(request),
  });
}

async function logFactuur(entry: {
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

  // --- Authenticatie ---
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!apiKey) {
    await logAccess(request, 401, "Authorization header ontbreekt");
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
    await logAccess(request, 403, "Onbekende API key");
    return NextResponse.json({ error: "Onbekende API key" }, { status: 403 });
  }

  // --- Rate limiting ---
  const { allowed, remaining, resetInMs } = checkRateLimit(project.id);
  if (!allowed) {
    await logAccess(request, 429, `Rate limit bereikt voor project ${project.naam}`);
    return NextResponse.json(
      { error: "Te veel aanvragen — probeer het over een minuut opnieuw" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(resetInMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // --- Request validatie ---
  let body: VerkoopfactuurPayload;
  try {
    body = await request.json();
  } catch {
    await logAccess(request, 400, "Ongeldige JSON");
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  if (
    !body.klant?.id ||
    !body.factuurnummer ||
    !body.factuurbedrag ||
    !body.boekingsregels?.length
  ) {
    const error =
      "Verplichte velden ontbreken: klant.id, factuurnummer, factuurbedrag, boekingsregels";
    await logAccess(request, 400, error);
    return NextResponse.json({ error }, { status: 400 });
  }

  // --- Factuur aanmaken ---
  try {
    const factuur = await maakVerkoopfactuur(project.snelstartClientKey, body);

    await logFactuur({
      project_id: project.id,
      project_naam: project.naam,
      factuurnummer: body.factuurnummer,
      request_body: body,
      response_status: 201,
      response_body: factuur,
      error: null,
      duration_ms: Date.now() - start,
    });

    return NextResponse.json(factuur, {
      status: 201,
      headers: { "X-RateLimit-Remaining": String(remaining) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";

    await logFactuur({
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
