import { supabase } from "@/lib/supabase";

export interface Project {
  id: string;
  naam: string;
  snelstartClientKey: string;
}

// In-memory cache — wordt ververst elke 5 minuten
let cache: Map<string, Project> | null = null;
let cacheExpiresAt = 0;

async function laadProjecten(): Promise<Map<string, Project>> {
  if (cache && Date.now() < cacheExpiresAt) {
    return cache;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, naam, api_key, snelstart_client_key")
    .eq("actief", true);

  if (error) {
    throw new Error(`Projecten ophalen mislukt: ${error.message}`);
  }

  const map = new Map<string, Project>();
  for (const row of data ?? []) {
    map.set(row.api_key, {
      id: row.id,
      naam: row.naam,
      snelstartClientKey: row.snelstart_client_key,
    });
  }

  cache = map;
  cacheExpiresAt = Date.now() + 5 * 60 * 1000; // 5 minuten
  return map;
}

export async function zoekProjectOpApiKey(
  apiKey: string
): Promise<Project | null> {
  const projecten = await laadProjecten();
  return projecten.get(apiKey) ?? null;
}
