import { NextRequest, NextResponse } from "next/server";
import { maakVerkoopfactuur, VerkoopfactuurPayload } from "@/lib/snelstart";
import { zoekProjectOpApiKey } from "@/lib/projects";

export async function POST(request: NextRequest) {
  // Authenticatie: Authorization: Bearer <api-key>
  const authHeader = request.headers.get("authorization") ?? "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Authorization header ontbreekt" },
      { status: 401 }
    );
  }

  const project = zoekProjectOpApiKey(apiKey);
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
    return NextResponse.json(factuur, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
