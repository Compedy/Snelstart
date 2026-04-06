const TOKEN_URL = "https://auth.snelstart.nl/b2b/token";
const API_BASE = "https://b2bapi.snelstart.nl/v2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Geld {
  amount: number;
  currency: "EUR";
}

export interface Boekingsregel {
  omschrijving: string;
  bedrag: Geld;
  grootboek: { id: string };
  btwSoort: BtwSoort;
}

// BTW soorten zoals Snelstart ze verwacht
export type BtwSoort =
  | "Geen"
  | "Hoog_Verk_21"
  | "Laag_Verk_9"
  | "Hoog_Ink_21"
  | "Laag_Ink_9"
  | "BtwVerlegd"
  | "IcpHoog"
  | "IcpGeenBtw";

export interface VerkoopfactuurPayload {
  klant: { id: string };
  factuurnummer: string;
  factuurDatum: string; // ISO 8601: "2024-01-15T00:00:00"
  vervalDatum?: string;
  omschrijving?: string;
  boekingsregels: Boekingsregel[];
  factuurbedrag: Geld;
}

// ---------------------------------------------------------------------------
// Token cache (in-memory per serverless instance)
// ---------------------------------------------------------------------------

let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;

async function getAccessToken(clientKey: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "clientkey", clientkey: clientKey }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Snelstart auth mislukt (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token as string;
  tokenExpiresAt = Date.now() + (data.expires_in as number) * 1000;
  return cachedToken;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const clientKey = process.env.SNELSTART_CLIENT_KEY;
  const subscriptionKey = process.env.SNELSTART_SUBSCRIPTION_KEY;

  if (!clientKey || !subscriptionKey) {
    throw new Error(
      "SNELSTART_CLIENT_KEY en SNELSTART_SUBSCRIPTION_KEY zijn vereist"
    );
  }

  const token = await getAccessToken(clientKey);

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Ocp-Apim-Subscription-Key": subscriptionKey,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Snelstart API fout ${res.status} op ${path}: ${text}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Verkoopfacturen
// ---------------------------------------------------------------------------

export async function maakVerkoopfactuur(
  payload: VerkoopfactuurPayload
): Promise<unknown> {
  return request("POST", "/verkoopfacturen", payload);
}

export async function getVerkoopfactuur(id: string): Promise<unknown> {
  return request("GET", `/verkoopfacturen/${id}`);
}

export async function lijstVerkoopfacturen(
  skip = 0,
  top = 50,
  filter?: string
): Promise<unknown> {
  const params = new URLSearchParams({ $skip: String(skip), $top: String(top) });
  if (filter) params.set("$filter", filter);
  return request("GET", `/verkoopfacturen?${params}`);
}
