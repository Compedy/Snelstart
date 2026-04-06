export interface Project {
  naam: string;
  snelstartClientKey: string;
}

/**
 * Leest projecten uit environment variables in dit formaat:
 *   PROJECT_1_API_KEY=...
 *   PROJECT_1_CLIENT_KEY=...
 *   PROJECT_1_NAAM=Kaasboer BV        (optioneel)
 *
 *   PROJECT_2_API_KEY=...
 *   PROJECT_2_CLIENT_KEY=...
 *   PROJECT_2_NAAM=Autobedrijf Jansen  (optioneel)
 */
function laadProjecten(): Map<string, Project> {
  const projecten = new Map<string, Project>();
  let i = 1;

  while (true) {
    const apiKey = process.env[`PROJECT_${i}_API_KEY`];
    const clientKey = process.env[`PROJECT_${i}_CLIENT_KEY`];

    if (!apiKey || !clientKey) break;

    projecten.set(apiKey, {
      naam: process.env[`PROJECT_${i}_NAAM`] ?? `Project ${i}`,
      snelstartClientKey: clientKey,
    });

    i++;
  }

  return projecten;
}

// Eenmalig inladen bij opstarten van de serverless functie
const projecten = laadProjecten();

export function zoekProjectOpApiKey(apiKey: string): Project | null {
  return projecten.get(apiKey) ?? null;
}
