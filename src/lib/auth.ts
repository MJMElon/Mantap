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

// ── Admin ─────────────────────────────────────────────────────────────
export async function isAdminSignedIn(): Promise<boolean> {
  const { data } = await adminSupabase.auth.getSession();
  return data.session?.user.email === SUPER_ADMIN_EMAIL;
}
export async function signOutAdmin() {
  await adminSupabase.auth.signOut().catch(() => {});
}
