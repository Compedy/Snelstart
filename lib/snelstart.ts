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
// Token cache — per client key
// ---------------------------------------------------------------------------

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(clientKey: string): Promise<string> {
  const cached = tokenCache.get(clientKey);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.token;
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
  tokenCache.set(clientKey, {
    token: data.access_token as string,
    expiresAt: Date.now() + (data.expires_in as number) * 1000,
  });
  return data.access_token as string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

async function request<T>(
  clientKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const subscriptionKey = process.env.SNELSTART_SUBSCRIPTION_KEY;
  if (!subscriptionKey) {
    throw new Error("SNELSTART_SUBSCRIPTION_KEY is vereist");
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

  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Verkoopfacturen
// ---------------------------------------------------------------------------

export async function maakVerkoopfactuur(
  clientKey: string,
  payload: VerkoopfactuurPayload
): Promise<unknown> {
  return request(clientKey, "POST", "/verkoopfacturen", payload);
}

export async function getVerkoopfactuur(
  clientKey: string,
  id: string
): Promise<unknown> {
  return request(clientKey, "GET", `/verkoopfacturen/${id}`);
}

export async function lijstVerkoopfacturen(
  clientKey: string,
  skip = 0,
  top = 50,
  filter?: string
): Promise<unknown> {
  const params = new URLSearchParams({ $skip: String(skip), $top: String(top) });
  if (filter) params.set("$filter", filter);
  return request(clientKey, "GET", `/verkoopfacturen?${params}`);
}
