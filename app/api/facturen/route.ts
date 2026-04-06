import { NextRequest, NextResponse } from "next/server";
import { maakVerkoopfactuur, VerkoopfactuurPayload } from "@/lib/snelstart";

export async function POST(request: NextRequest) {
  let body: VerkoopfactuurPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  // Minimale validatie
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
    const factuur = await maakVerkoopfactuur(body);
    return NextResponse.json(factuur, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Onbekende fout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
