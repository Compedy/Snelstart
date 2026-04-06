import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  // Controleer Supabase connectie
  const { error } = await supabase.from("projects").select("id").limit(1);

  if (error) {
    return NextResponse.json(
      { status: "unhealthy", error: error.message },
      { status: 503 }
    );
  }

  return NextResponse.json({ status: "ok" }, { status: 200 });
}
