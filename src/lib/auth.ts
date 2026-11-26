import { SUPER_ADMIN_EMAIL, WORKER_SESSION_KEY } from './config';
import { adminSupabase, callFunction, supabase } from './supabase';
import type { WorkerSession } from './types';

// ── Worker session (also read by the Stock module) ────────────────────
export function getWorker(): WorkerSession | null {
  try { return JSON.parse(localStorage.getItem(WORKER_SESSION_KEY) ?? 'null'); } catch { return null; }
}
function setWorker(w: WorkerSession, prev: WorkerSession | null) {
  // Keep the estate the worker last picked in Stock, if still allowed.
  const estate = prev?.estate && w.estates.includes(prev.estate) ? prev.estate : '';
  localStorage.setItem(WORKER_SESSION_KEY, JSON.stringify({ ...w, estate }));
}
export async function signOutWorker() {
  localStorage.removeItem(WORKER_SESSION_KEY);
  sessionStorage.removeItem('opp_active_section');
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

interface SignInResult {
  session: { access_token: string; refresh_token: string };
  worker: WorkerSession;
}

/** Signs in a worker or the Super Admin. Throws Error(textKey). */
export async function signIn(rawId: string, password: string): Promise<'worker' | 'admin'> {
  const id = rawId.trim().toLowerCase();
  if (!id) throw new Error('err_empty_id');
  if (!password) throw new Error('err_empty_pw');

  if (id === SUPER_ADMIN_EMAIL) {
    const { error } = await adminSupabase.auth.signInWithPassword({ email: id, password });
    if (error) throw new Error('err_wrong');
    return 'admin';
  }

  // Password is checked on the server; the browser never sees password hashes.
  const r = await callFunction<SignInResult>(supabase, 'mantap-worker-auth', { action: 'sign_in', userId: id, password });
  await supabase.auth.setSession(r.session);
  setWorker(r.worker, null);
  return 'worker';
}

/** Re-reads the signed-in worker (access, estates, status may have changed).
 *  Returns null when the worker must sign in again. */
export async function refreshWorker(): Promise<WorkerSession | null> {
  const prev = getWorker();
  if (!prev) return null;
  try {
    const r = await callFunction<{ worker: WorkerSession }>(supabase, 'mantap-worker-auth', { action: 'me' });
    setWorker(r.worker, prev);
    return getWorker();
  } catch (e) {
    if (e instanceof Error && e.message === 'err_network') return prev; // offline: keep cached
    await signOutWorker();
    return null;
  }
}

// ── Sign-in from MJM Intranet (?gw_token=…) ──────────────────────────
interface SsoResult {
  session: { access_token: string; refresh_token: string };
  portal: { email: string; name: string; web: boolean; mobile: boolean };
  worker: WorkerSession | null;
}

/** Reads and removes ?gw_token from the address bar. */
export function takeIntranetToken(): string | null {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('gw_token');
  if (!token) return null;
  url.searchParams.delete('gw_token');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return token;
}

/** Redeems the Intranet token. Web access → admin session; mobile access → worker session. */
export async function signInFromIntranet(token: string): Promise<SsoResult['portal']> {
  const r = await callFunction<SsoResult>(supabase, 'mantap-sso', { token });
  if (r.portal.web) await adminSupabase.auth.setSession(r.session);
  if (r.portal.mobile && r.worker) {
    await supabase.auth.setSession(r.session);
    setWorker(r.worker, getWorker());
  }
  return r.portal;
}

// ── Arriving from Plantation Operation (PORT) ────────────────────────
// The company PORT opened us for (its MJM Intranet id and name), kept for this tab.
const PORT_COMPANY_KEY = 'mantap_port_company';
export interface PortCompany { id: string; name: string }
export function setPortCompany(c: PortCompany | null) {
  try { if (c) sessionStorage.setItem(PORT_COMPANY_KEY, JSON.stringify(c)); else sessionStorage.removeItem(PORT_COMPANY_KEY); } catch { /* private mode */ }
}
export function portCompany(): PortCompany | null {
  try { const c = JSON.parse(sessionStorage.getItem(PORT_COMPANY_KEY) || 'null'); return c && typeof c.id === 'string' ? c : null; } catch { return null; }
}

// PORT and Mantap share one Supabase project, so PORT's sign-in session works
// here. PORT opens #/portal/workers?pt=<access token>&pr=<refresh token>.
export async function takePortSession(): Promise<boolean> {
  const hash = window.location.hash || '';
  const q = hash.indexOf('?');
  if (q < 0) return false;
  const params = new URLSearchParams(hash.slice(q + 1));
  const pt = params.get('pt'), pr = params.get('pr');
  // The company chosen on PORT's front page: Worker Manage shows only its workers
  const co = params.get('co'), con = params.get('con');
  if (co) setPortCompany({ id: co, name: con || '' });
  params.delete('co'); params.delete('con');
  if (!pt || !pr) {
    if (co) window.history.replaceState(null, '', window.location.pathname + window.location.search + hash.slice(0, q) + (params.toString() ? '?' + params.toString() : ''));
    return false;
  }
  params.delete('pt'); params.delete('pr');
  const rest = params.toString();
  window.history.replaceState(null, '', window.location.pathname + window.location.search + hash.slice(0, q) + (rest ? '?' + rest : ''));
  const { error } = await adminSupabase.auth.setSession({ access_token: pt, refresh_token: pr });
  return !error;
}

// ── Web portal (Super Admin or Intranet user with web access) ─────────
export interface PortalMe { email: string; name: string; isSuper: boolean }

/** Returns who is signed in to the web portal, or null. */
export async function portalMe(): Promise<PortalMe | null> {
  const { data } = await adminSupabase.auth.getSession();
  if (!data.session) return null;
  try {
    return await callFunction<PortalMe>(adminSupabase, 'mantap-worker-admin', { action: 'whoami' });
  } catch {
    return null;
  }
}

/** True when someone is signed in to the web portal. */
export async function isAdminSignedIn(): Promise<boolean> {
  return !!(await portalMe());
}

export async function signOutAdmin() {
  await adminSupabase.auth.signOut().catch(() => {});
}
