/**
 * Schlanker Client für die Factorial-HR-API (https://api.factorialhr.com).
 * Authentifizierung per Firmen-API-Schlüssel im Header `x-api-key`.
 * Listen-Endpunkte sind cursorbasiert paginiert (meta.end_cursor → after_id).
 */

export const DEFAULT_FACTORIAL_API_VERSION = "2026-10-01";

export function isFactorialConfigured() {
  return Boolean(process.env.FACTORIAL_API_KEY);
}

function config() {
  const apiKey = process.env.FACTORIAL_API_KEY;
  if (!apiKey) {
    throw new Error("Factorial ist nicht konfiguriert. Bitte FACTORIAL_API_KEY in der .env-Datei hinterlegen.");
  }
  return {
    apiKey,
    baseUrl: (process.env.FACTORIAL_BASE_URL || "https://api.factorialhr.com").replace(/\/$/, ""),
    version: process.env.FACTORIAL_API_VERSION || DEFAULT_FACTORIAL_API_VERSION,
  };
}

export class FactorialApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Query = Record<string, string | number | boolean | undefined>;

async function request<T>(path: string, query: Query = {}, retries = 3): Promise<T> {
  const { apiKey, baseUrl, version } = config();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const url = `${baseUrl}/api/${version}/resources/${path}${params.size ? `?${params}` : ""}`;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { "x-api-key": apiKey, Accept: "application/json" }, cache: "no-store" });
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const wait = Number(res.headers.get("Retry-After")) || 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const hint =
        res.status === 401 || res.status === 403
          ? " – API-Schlüssel ungültig oder ohne Berechtigung."
          : res.status === 404
            ? ` – Endpunkt nicht gefunden (API-Version ${version} prüfen).`
            : "";
      throw new FactorialApiError(res.status, `Factorial-API-Fehler ${res.status}${hint} ${text.slice(0, 300)}`.trim());
    }
    return res.json() as Promise<T>;
  }
}

interface PagedResponse<T> {
  data?: T[];
  meta?: { end_cursor?: string; has_next_page?: boolean };
}

async function listAll<T>(path: string, query: Query, maxItems = 5000): Promise<T[]> {
  const items: T[] = [];
  let after: string | undefined;
  do {
    const page = await request<PagedResponse<T>>(path, { ...query, limit: 100, after_id: after });
    items.push(...(page.data ?? []));
    after = page.meta?.has_next_page ? page.meta.end_cursor : undefined;
  } while (after && items.length < maxItems);
  return items;
}

export interface FactorialEmployee {
  id: string | number;
  first_name: string;
  last_name: string;
  full_name: string;
  preferred_name?: string | null;
  email?: string | null;
  login_email?: string | null;
  communications_email?: string | null;
  active?: boolean | null;
  terminated_on?: string | null;
  manager_id?: string | number | null;
}

export interface FactorialLeave {
  id: string | number;
  employee_id: string | number;
  start_on: string;
  finish_on?: string | null;
  half_day?: string | null;
  description?: string | null;
  leave_type_name?: string | null;
  approved?: boolean | null;
  employee_full_name?: string | null;
  deleted_at?: string | null;
}

export function listEmployees() {
  return listAll<FactorialEmployee>("employees/employees", { only_active: true, only_managers: false });
}

/** Abwesenheiten im Zeitraum, genehmigt und noch ausstehend (abgelehnte werden ausgelassen). */
export function listLeaves(from: string, to: string) {
  return listAll<FactorialLeave>("timeoff/leaves", {
    from,
    to,
    approved: true,
    include_pending: true,
    include_deleted_leaves: false,
    include_leave_type: true,
  });
}
