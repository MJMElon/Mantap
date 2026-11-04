// Shared helpers for Mantap Edge Functions.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = (Deno.env.get('MANTAP_ALLOWED_ORIGINS') ??
  'https://mjmelon.github.io,http://localhost:5173,http://localhost:4173').split(',');

export const SUPER_ADMIN_EMAIL = Deno.env.get('SUPER_ADMIN_EMAIL') ?? 'hqadmin.puigroups@gmail.com';
export const USERS_TABLE = 'opp_users';
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
