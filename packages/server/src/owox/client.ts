import type { OwoxKeyParts, DataMartListItem, CreateDataMartInput } from "./types";
type FetchFn = typeof fetch;

export function parseApiKey(key: string): OwoxKeyParts {
  const k = key.trim();
  if (!k.startsWith("owox_key_")) throw new Error("API key must start with owox_key_");
  const json = JSON.parse(Buffer.from(k.slice("owox_key_".length), "base64url").toString("utf8"));
  if (!json.apiOrigin || !json.apiKeyId || !json.apiKeySecret) throw new Error("API key missing fields");
  return { apiOrigin: String(json.apiOrigin).replace(/\/$/, ""), apiKeyId: json.apiKeyId, apiKeySecret: json.apiKeySecret };
}

export async function exchangeToken(p: OwoxKeyParts, f: FetchFn = fetch): Promise<string> {
  const res = await f(`${p.apiOrigin}/api/auth/api-keys/exchange`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-OWOX-Api-Key-Id": p.apiKeyId },
    body: JSON.stringify({ apiKeySecret: p.apiKeySecret }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json() as { accessToken?: string };
  if (!data.accessToken) throw new Error("No accessToken in exchange response");
  return data.accessToken;
}

export function decodeProjectFromToken(token: string): { projectTitle?: string; fullName?: string; email?: string } {
  // JWT payload fields confirmed against the live API: projectTitle, userFullName, userEmail.
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return { projectTitle: p.projectTitle, fullName: p.userFullName, email: p.userEmail };
  } catch { return {}; }
}

export class OwoxClient {
  constructor(private origin: string, private token: string, private keyId: string, private f: FetchFn = fetch) {}
  // Every /api/* call needs BOTH x-owox-authorization AND X-OWOX-Api-Key-Id;
  // missing the key-id header makes OWOX respond 403 (confirmed against the live API).
  private h() { return { "x-owox-authorization": `Bearer ${this.token}`, "X-OWOX-Api-Key-Id": this.keyId, "Content-Type": "application/json" }; }
  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.f(`${this.origin}${path}`, { method, headers: this.h(), body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) throw new Error(`OWOX ${method} ${path} -> ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
  async listDataMarts(): Promise<DataMartListItem[]> {
    const out: DataMartListItem[] = []; let offset: number | undefined;
    for (;;) {
      const qs = offset !== undefined ? `?offset=${offset}` : "";
      const page = await this.json<{ items: DataMartListItem[]; nextOffset: number | null }>("GET", `/api/data-marts${qs}`);
      out.push(...page.items); if (page.nextOffset === null || page.nextOffset === undefined) break; offset = page.nextOffset;
    }
    return out;
  }
  getDataMart(id: string) { return this.json<any>("GET", `/api/data-marts/${encodeURIComponent(id)}`); }
  createDataMart(input: CreateDataMartInput) { return this.json<{ id: string }>("POST", "/api/data-marts", input); }
  updateTitle(id: string, title: string) { return this.json("PUT", `/api/data-marts/${id}/title`, { title }); }
  updateDescription(id: string, description: string) { return this.json("PUT", `/api/data-marts/${id}/description`, { description }); }
  updateDefinition(id: string, body: unknown) { return this.json("PUT", `/api/data-marts/${id}/definition`, body); }
  // body is the storage-specific envelope: { schema: { type, fields:[...] } }
  updateSchema(id: string, body: unknown) { return this.json("PUT", `/api/data-marts/${id}/schema`, body); }
  deleteDataMart(id: string) { return this.json("DELETE", `/api/data-marts/${id}`); }
  listStorages() { return this.json<any[]>("GET", "/api/data-storages"); }
  // Joinable relationship (confirmed live): POST .../{sourceId}/relationships,
  // body { targetDataMartId, targetAlias (required), joinConditions:[{sourceFieldName,targetFieldName}] }.
  createRelationship(sourceId: string, body: { targetDataMartId: string; targetAlias: string; joinConditions: { sourceFieldName: string; targetFieldName: string }[] }) {
    return this.json<{ id: string }>("POST", `/api/data-marts/${encodeURIComponent(sourceId)}/relationships`, body);
  }
}
