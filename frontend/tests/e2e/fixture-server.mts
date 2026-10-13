/** Test-only Supabase-compatible HTTP fixture backed by the real migration and RLS.
 * This server is never imported by the app and contains only disposable test accounts.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { japanDate } from "../../lib/calendar";

const secret = "calendar-disposable-test-signing-key";
const family = "20000000-0000-0000-0000-000000000001";
const accountIds = Array.from({ length: 5 }, (_, index) => `10000000-0000-0000-0000-00000000000${index + 1}`);
const emails = ["me@example.com", "mother@example.com", "father@example.com", "sister@example.com", "stranger@example.com"];
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;`);
await db.exec(await readFile(new URL("../../supabase/migrations/202610130001_family_car_calendar.sql", import.meta.url), "utf8"));
await db.query("insert into public.families(id,name) values ($1,'うちの家族')", [family]);
for (let index = 0; index < accountIds.length; index++) {
  await db.query("insert into auth.users(id,email) values ($1,$2)", [accountIds[index], emails[index]]);
  if (index < 4) await db.query("insert into public.profiles(id,family_id,name,color,avatar) values ($1,$2,$3,$4,$5)", [accountIds[index], family, ["自分", "母", "父", "妹"][index], ["#2563eb", "#b45309", "#7c3aed", "#be185d"][index], ["👦", "👩", "👨", "👧"][index]]);
}
await db.query("insert into public.schedules(family_id,user_id,date,start_time,end_time,purpose,memo,created_by) values ($1,$2,$3,'15:00','17:00','🛒 買い物','スーパーへ',$2)", [family, accountIds[1], japanDate()]);

function user(id: string) {
  return { id, aud: "authenticated", role: "authenticated", email: emails[accountIds.indexOf(id)], email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, identities: [] };
}
function signedToken(id: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ sub: id, email: user(id).email, aud: "authenticated", role: "authenticated", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, iss: "http://127.0.0.1:54329/auth/v1", session_id: "30000000-0000-0000-0000-000000000001", aal: "aal1" })).toString("base64url");
  return `${header}.${payload}.${createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")}`;
}
function verifiedId(req: IncomingMessage) {
  const token = req.headers.authorization?.replace(/^Bearer /, "") ?? "";
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || signature !== createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url")) return null;
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  return accountIds.includes(claims.sub) && claims.exp > Date.now() / 1000 ? String(claims.sub) : null;
}
function send(res: ServerResponse, status: number, value: unknown) { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); }
let queue = Promise.resolve();
async function handle(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:54329");
  if (url.pathname === "/health") { send(res, 200, { ready: true }); return; }
  let body = "";
  for await (const chunk of req) body += chunk;
  const input = body ? JSON.parse(body) as Record<string, unknown> : {};
  if (url.pathname === "/auth/v1/token") {
    const index = url.searchParams.get("grant_type") === "refresh_token" ? accountIds.indexOf(String(input.refresh_token)) : emails.indexOf(String(input.email));
    if (index < 0 || (url.searchParams.get("grant_type") !== "refresh_token" && input.password !== "test-password")) { send(res, 400, { error_code: "invalid_credentials", msg: "Invalid login credentials" }); return; }
    const id = accountIds[index];
    send(res, 200, { access_token: signedToken(id), refresh_token: id, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: user(id) }); return;
  }
  const id = verifiedId(req);
  if (url.pathname === "/auth/v1/user") { send(res, id ? 200 : 401, id ? user(id) : { msg: "Invalid token" }); return; }
  if (url.pathname === "/auth/v1/logout") { res.writeHead(204); res.end(); return; }
  if (url.pathname === "/auth/v1/.well-known/jwks.json") { send(res, 200, { keys: [] }); return; }
  if (!id) { send(res, 401, { message: "Unauthenticated" }); return; }
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
  try {
    if (url.pathname === "/rest/v1/rpc/save_schedule") {
      const result = await db.query<{ result: unknown }>("select public.save_schedule($1::uuid,$2::date,$3::time,$4::time,$5::text,$6::text,$7::uuid,$8::uuid[],$9::timestamptz) as result", [input.p_user_id, input.p_date, input.p_start_time, input.p_end_time, input.p_purpose, input.p_memo, input.p_id, input.p_acknowledged_ids, input.p_expected_updated_at]);
      send(res, 200, result.rows[0].result); return;
    }
    const table = url.pathname.split("/").at(-1);
    if (!table || !["families", "profiles", "schedules"].includes(table)) { send(res, 404, {}); return; }
    const values: unknown[] = [], conditions: string[] = [];
    for (const field of ["id", "family_id", "created_by"]) {
      const filter = url.searchParams.get(field);
      if (filter?.startsWith("eq.")) { values.push(filter.slice(3)); conditions.push(`${field}=$${values.length}`); }
    }
    const or = url.searchParams.get("or");
    if (or && table === "schedules") {
      const dates = or.match(/\d{4}-\d{2}-\d{2}/g);
      if (dates?.length === 3) { const base = values.length; values.push(...dates); conditions.push(`((date >= $${base + 1} and date <= $${base + 2}) or date = $${base + 3})`); }
    }
    const where = conditions.length ? ` where ${conditions.join(" and ")}` : "";
    let query: string;
    if (req.method === "PATCH") {
      const allowed = table === "profiles" ? ["name", "avatar", "color"] : ["user_id", "date", "start_time", "end_time", "purpose", "memo"];
      const sets = Object.entries(input).filter(([key]) => allowed.includes(key)).map(([key, value]) => { values.push(value); return `${key}=$${values.length}`; });
      query = `update public.${table} set ${sets.join(",")} ${where} returning *`;
    } else if (req.method === "DELETE") query = `delete from public.${table}${where} returning *`;
    else {
      const offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 500);
      const columns = table === "schedules" ? "id,family_id,user_id,date::text,start_time::text,end_time::text,purpose,memo,created_by,created_at::text,updated_at::text" : "*";
      query = `select ${columns} from public.${table}${where} order by ${table === "schedules" ? "date,start_time,id" : "created_at,id"} limit ${limit} offset ${offset}`;
    }
    const result = await db.query(query, values);
    const object = req.headers.accept?.includes("application/vnd.pgrst.object+json");
    send(res, object && !result.rows.length ? 406 : 200, object ? result.rows[0] ?? { code: "PGRST116", details: "0 rows" } : result.rows);
  } finally { await db.exec("reset role"); }
}
const server = createServer((req, res) => {
  queue = queue.then(() => handle(req, res)).catch(error => { if (!res.headersSent) send(res, 500, { message: String(error) }); else res.end(); });
});
server.listen(54329, "127.0.0.1", () => console.log("Disposable Supabase fixture ready on 127.0.0.1:54329"));
process.on("SIGTERM", () => server.close(() => { void db.close().then(() => process.exit(0)); }));
