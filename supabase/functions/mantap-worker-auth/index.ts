// Worker sign-in for Mantap.
//   { action: 'sign_in', userId, password } → { session, worker }
//   { action: 'me' } (with the worker's JWT)  → { worker }
// The password hash never leaves the server. After 5 wrong passwords the
// User ID is locked for 15 minutes.
import {
  anonClient, ApiError, callerEmail, handler, roleOf, serviceClient, sha256Hex,
  timingSafeEqual, toAuthEmail, toWorkerSession, USERS_TABLE, WORKER_ROLE, type UserRow,
} from '../_shared/common.ts';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

async function loadWorker(email: string): Promise<UserRow> {
  const { data, error } = await serviceClient().from(USERS_TABLE).select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiError('err_wrong', 401);
  return data as UserRow;
}

function assertUsable(row: UserRow) {
  if (row.status === 'inactive') throw new ApiError('err_inactive', 403);
  if (roleOf(row) !== WORKER_ROLE) throw new ApiError('err_not_worker', 403);
}

async function checkLock(email: string) {
  const { data } = await serviceClient().from('mantap_login_attempts').select('locked_until').eq('email', email).maybeSingle();
  if (data?.locked_until && new Date(data.locked_until) > new Date()) throw new ApiError('err_locked', 429);
}

async function recordAttempt(email: string, ok: boolean) {
  const db = serviceClient();
  if (ok) { await db.from('mantap_login_attempts').delete().eq('email', email); return; }
  const { data } = await db.from('mantap_login_attempts').select('fails').eq('email', email).maybeSingle();
  const fails = (data?.fails ?? 0) + 1;
  const locked_until = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  await db.from('mantap_login_attempts').upsert({ email, fails: locked_until ? 0 : fails, locked_until, updated_at: new Date().toISOString() });
}

/** Creates the worker's Supabase Auth user if needed and returns a session for it. */
async function issueSession(row: UserRow) {
  const admin = serviceClient().auth.admin;
  const created = await admin.createUser({ email: row.email, email_confirm: true, user_metadata: { opp_user_id: row.id, name: row.name } });
  if (created.error && !/already|exists|registered/i.test(created.error.message)) throw created.error;

  const link = await admin.generateLink({ type: 'magiclink', email: row.email });
  if (link.error) throw link.error;
  const { data, error } = await anonClient().auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
  if (error || !data.session) throw error ?? new Error('no session');
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

Deno.serve(handler(async (req, body) => {
  if (body.action === 'sign_in') {
    const userId = String(body.userId ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!userId) throw new ApiError('err_empty_id');
    if (!password) throw new ApiError('err_empty_pw');
    const email = toAuthEmail(userId);

    await checkLock(email);
    let row: UserRow;
    try {
      row = await loadWorker(email);
    } catch (e) {
      if (e instanceof ApiError) await recordAttempt(email, false);
      throw e;
    }
    const ok = !!row.password_hash && timingSafeEqual(row.password_hash, await sha256Hex(password));
    await recordAttempt(email, ok);
    if (!ok) throw new ApiError('err_wrong', 401);
    assertUsable(row);

    const session = await issueSession(row);
    await serviceClient().from(USERS_TABLE).update({ last_active: new Date().toISOString() }).eq('id', row.id);
    return { session, worker: toWorkerSession(row) };
  }

  if (body.action === 'me') {
    const email = await callerEmail(req);
    if (!email) throw new ApiError('err_forbidden', 401);
    const row = await loadWorker(email).catch(() => { throw new ApiError('err_inactive', 403); });
    assertUsable(row);
    return { worker: toWorkerSession(row) };
  }

  throw new ApiError('err_invalid');
}));
