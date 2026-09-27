import { json, preflight } from "@/server/http";

export function GET() {
  return json({ ok: true, service: "eduprep-api", time: new Date().toISOString() });
}

export const OPTIONS = preflight;
