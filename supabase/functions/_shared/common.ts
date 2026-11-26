// Shared helpers for Mantap Edge Functions.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Plantation Operation (PORT, oliviawsc.github.io) calls these functions too
// (Worker Manage → Worker list), so its address is always allowed.
const PORT_ORIGIN = 'https://oliviawsc.github.io';
const ALLOWED_ORIGINS = [...new Set([
  ...(Deno.env.get('MANTAP_ALLOWED_ORIGINS') ?? 'https://mjmelon.github.io,http://localhost:5173,http://localhost:4173').split(',').map((o: string) => o.trim()).filter(Boolean),
  PORT_ORIGIN,
])];

export const SUPER_ADMIN_EMAIL = Deno.env.get('SUPER_ADMIN_EMAIL') ?? 'hqadmin.puigroups@gmail.com';
export const USERS_TABLE = 'port_users';
export const WORKER_ROLE = 'estate_user';
export const STOCK_ITEMS = ['estate_baja', 'estate_racun', 'estate_anak', 'mobile_rainfall', 'tools_mobile_cat'];

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** Error with an i18n code the frontend understands (err_*) and an HTTP status. */
export class ApiError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export function handler(fn: (req: Request, body: Record<string, unknown>) => Promise<unknown>) {
  return async (req: Request): Promise<Response> => {
    const headers = { ...corsHeaders(req), 'Content-Type': 'application/json' };
    if (req.method === 'OPTIONS') return new Response('ok', { headers });
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'err_invalid' }), { status: 405, headers });
    try {
      const body = await req.json().catch(() => ({}));
      const result = await fn(req, body && typeof body === 'object' ? body : {});
      return new Response(JSON.stringify(result), { headers });
    } catch (e) {
      if (e instanceof ApiError) return new Response(JSON.stringify({ error: e.code }), { status: e.status, headers });
      console.error(e);
      return new Response(JSON.stringify({ error: 'err_network' }), { status: 500, headers });
    }
  };
}

/** Service-role client: bypasses RLS. Only ever used inside these functions. */
export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anon client, optionally acting as the caller (their JWT from the request). */
export function anonClient(req?: Request): SupabaseClient {
  const auth = req?.headers.get('Authorization');
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: auth ? { headers: { Authorization: auth } } : undefined,
  });
}

/** Email of the signed-in caller, or null. */
export async function callerEmail(req: Request): Promise<string | null> {
  const { data } = await anonClient(req).auth.getUser();
  return data.user?.email?.toLowerCase() ?? null;
}

// Same password format the Stock app uses (hex SHA-256), so existing passwords keep working.
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function toAuthEmail(userId: string): string {
  return userId.includes('@') ? userId : `${userId}@psms.app`;
}

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash?: string | null;
  estates: string[] | null;
  permissions: Record<string, unknown> | null;
  status: string | null;
  last_active: string | null;
}

export const roleOf = (row: UserRow) =>
  row.permissions && typeof row.permissions === 'object' ? (row.permissions as { __role?: string }).__role ?? 'user' : 'user';

/** Creates the Supabase Auth user for `email` if needed and returns a session for it
 *  (no password: a one-time magic-link token is generated and redeemed on the server). */
export async function issueSession(email: string, meta: Record<string, unknown>) {
  const admin = serviceClient().auth.admin;
  const created = await admin.createUser({ email, email_confirm: true, user_metadata: meta });
  if (created.error && !/already|exists|registered/i.test(created.error.message)) throw created.error;
  const link = await admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  const { data, error } = await anonClient().auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
  if (error || !data.session) throw error ?? new Error('no session');
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

export interface PortalUser {
  email: string;
  name: string;
  intranet_user_id: string | null;
  web_access: boolean;
  mobile_access: boolean;
}

export async function getPortalUser(email: string): Promise<PortalUser | null> {
  const { data, error } = await serviceClient().from('mantap_portal_users').select('*').eq('email', email.toLowerCase()).maybeSingle();
  if (error) throw error;
  return (data as PortalUser) ?? null;
}

/** The worker session shape the Stock module expects (no password hash). */
export function toWorkerSession(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    estates: row.estates ?? [],
    estate: '',
    role: WORKER_ROLE,
    permissions: row.permissions ?? {},
  };
}

// ── Worker PIN, readable copy ─────────────────────────────────────────
// password_hash is one-way (nobody can read a PIN back). So that an Admin can
// show a worker's PIN (PORT → Worker list, eye button), a copy is also kept
// locked with AES-GCM: only these functions hold the key. Key = MANTAP_PIN_KEY
// if set, else derived from the project's service key. Made whenever a PIN is
// set or reset; older PINs stay unreadable until they are reset once.
async function pinKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('MANTAP_PIN_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!secret) throw new Error('no PIN key');
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('mantap-pin:' + secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export async function lockPin(pin: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await pinKey(), new TextEncoder().encode(pin)));
  return 'v1:' + b64(iv) + ':' + b64(ct);
}
export async function unlockPin(locked: string | null | undefined): Promise<string | null> {
  const m = /^v1:([^:]+):(.+)$/.exec(locked ?? '');
  if (!m) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(m[1]) }, await pinKey(), unb64(m[2]));
    return new TextDecoder().decode(pt);
  } catch { return null; } // key changed: unreadable until the PIN is reset
}
