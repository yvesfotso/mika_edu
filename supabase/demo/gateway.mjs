// Local demo only: stands in for the Supabase API gateway.
//   /rest/v1/*  -> PostgREST
//   /auth/v1/*  -> a tiny fake of Supabase Auth that knows the accounts in accounts.mjs
//   /storage/v1/object/* -> files on disk in .demo/storage (service role only: upload, download, remove)
// Usage: node gateway.mjs            (serve)
//        node gateway.mjs keys       (print anon + service-role keys for .env.local)
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { accounts, DEMO_PASSWORD } from "./accounts.mjs";

export const JWT_SECRET = process.env.DEMO_JWT_SECRET ?? "eduprep-local-demo-jwt-secret-not-for-production";
const PORT = Number(process.env.DEMO_GATEWAY_PORT ?? 54321);
const POSTGREST = process.env.DEMO_POSTGREST_URL ?? "http://127.0.0.1:54330";
const TOKEN_TTL = 3600;
const STORAGE_DIR = process.env.DEMO_STORAGE_DIR ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.demo/storage");

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function sign(claims) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

function verify(token) {
  const [head, body, sig] = (token ?? "").split(".");
  if (!head || !body || !sig) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const claims = JSON.parse(Buffer.from(body, "base64url").toString());
  if (claims.exp && claims.exp < Date.now() / 1000) return null;
  return claims;
}

const longLived = (role) => sign({ iss: "eduprep-demo", role, iat: 1760000000, exp: 2000000000 });
export const anonKey = longLived("anon");
export const serviceRoleKey = longLived("service_role");

function userJson(a) {
  return {
    id: a.id,
    aud: "authenticated",
    role: "authenticated",
    email: a.email,
    email_confirmed_at: "2026-09-26T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { display_name: a.name },
    created_at: "2026-09-26T00:00:00Z",
    updated_at: "2026-09-26T00:00:00Z",
  };
}

function session(a) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = sign({
    sub: a.id,
    email: a.email,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + TOKEN_TTL,
    session_id: a.id,
  });
  return {
    access_token,
    token_type: "bearer",
    expires_in: TOKEN_TTL,
    expires_at: now + TOKEN_TTL,
    refresh_token: `demo-refresh.${a.id}`,
    user: userJson(a),
  };
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "*",
  "access-control-expose-headers": "content-range, content-profile, x-supabase-api-version",
};

function send(res, status, body) {
  res.writeHead(status, { ...cors, "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

const authError = (res, status, error_code, msg) => send(res, status, { code: status, error_code, msg });

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    return {};
  }
}

function bearer(req) {
  const h = req.headers.authorization ?? "";
  return h.toLowerCase().startsWith("bearer ") ? h.slice(7) : null;
}

async function handleAuth(req, res, url) {
  const path = url.pathname.replace(/^\/auth\/v1/, "");

  if (path === "/token" && req.method === "POST") {
    const body = await readJson(req);
    const grant = url.searchParams.get("grant_type");
    let account;
    if (grant === "password") {
      account = accounts.find((a) => a.email === String(body.email ?? "").trim().toLowerCase());
      if (!account || body.password !== DEMO_PASSWORD) {
        return authError(res, 400, "invalid_credentials", "Invalid login credentials");
      }
    } else if (grant === "refresh_token") {
      const id = String(body.refresh_token ?? "").replace(/^demo-refresh\./, "");
      account = accounts.find((a) => a.id === id);
      if (!account) return authError(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
    } else {
      return authError(res, 400, "unsupported_grant_type", `Grant type ${grant} is not supported in the demo`);
    }
    return send(res, 200, session(account));
  }

  if (path === "/user" && req.method === "GET") {
    const claims = verify(bearer(req));
    const account = claims && accounts.find((a) => a.id === claims.sub);
    if (!account) return authError(res, 403, "bad_jwt", "invalid JWT");
    return send(res, 200, userJson(account));
  }

  if (path === "/logout") {
    res.writeHead(204, cors);
    return res.end();
  }

  if (path === "/settings" || path === "/health") return send(res, 200, { external: { email: true } });

  return authError(res, 404, "not_found", `The demo auth server does not implement ${req.method} ${path}`);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

/** Resolve bucket/key under STORAGE_DIR, refusing anything that would escape it. */
function objectFile(bucket, key) {
  if (!/^[a-z0-9-]+$/.test(bucket) || !key || key.split("/").some((seg) => !seg || seg === "." || seg === "..")) return null;
  return path.join(STORAGE_DIR, bucket, ...key.split("/"));
}

const MIME = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

// Only what the admin backend uses: upload (POST/PUT), download (GET), remove (DELETE with prefixes).
async function handleStorage(req, res, url) {
  if (verify(bearer(req) ?? req.headers.apikey)?.role !== "service_role") {
    return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "The demo storage only accepts the service role" });
  }
  const rest = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\//, ""));
  const [bucket, ...keyParts] = rest.split("/");
  const key = keyParts.join("/");

  if (req.method === "DELETE" && !key) {
    const { prefixes = [] } = await readJson(req);
    const removed = [];
    for (const p of prefixes) {
      const file = objectFile(bucket, String(p));
      if (!file) continue;
      await rm(file, { force: true });
      removed.push({ name: p, bucket_id: bucket });
    }
    return send(res, 200, removed);
  }

  const file = objectFile(bucket, key);
  if (!file) return send(res, 400, { statusCode: "400", error: "InvalidKey", message: "Invalid object path" });

  if (req.method === "POST" || req.method === "PUT") {
    const body = await readBody(req);
    if (req.method === "POST" && req.headers["x-upsert"] !== "true") {
      const exists = await readFile(file).then(() => true, () => false);
      if (exists) return send(res, 409, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
    }
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return send(res, 200, { Key: `${bucket}/${key}`, Id: `${bucket}/${key}` });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const data = await readFile(file).catch(() => null);
    if (!data) return send(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
    res.writeHead(200, { ...cors, "content-type": MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream", "content-length": data.length });
    return res.end(req.method === "HEAD" ? undefined : data);
  }

  return send(res, 405, { message: `The demo storage does not implement ${req.method}` });
}

function proxyRest(req, res, url) {
  const target = new URL(url.pathname.replace(/^\/rest\/v1/, "") + url.search, POSTGREST);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.apikey;
  if (!headers.authorization && req.headers.apikey) headers.authorization = `Bearer ${req.headers.apikey}`;

  const upstream = http.request(target, { method: req.method, headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
    up.pipe(res);
  });
  upstream.on("error", (err) => send(res, 502, { message: `PostgREST unreachable: ${err.message}` }));
  req.pipe(upstream);
}

function serve() {
  http
    .createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        return res.end();
      }
      if (url.pathname.startsWith("/auth/v1")) {
        handleAuth(req, res, url).catch((err) => send(res, 500, { msg: String(err) }));
        return;
      }
      if (url.pathname.startsWith("/rest/v1")) return proxyRest(req, res, url);
      if (url.pathname.startsWith("/storage/v1/object/")) {
        handleStorage(req, res, url).catch((err) => send(res, 500, { message: String(err) }));
        return;
      }
      send(res, 404, { message: "Not found" });
    })
    .listen(PORT, () => console.log(`[demo gateway] http://localhost:${PORT} -> ${POSTGREST}`));
}

if (process.argv[2] === "keys") {
  console.log(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}\nSUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
} else {
  serve();
}
