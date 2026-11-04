// Worker Portal web admin. Callers: the Stock Super Admin, or an MJM Intranet
// user with web access in Mantap's User Access list (mantap_portal_users).
// Workers: list, create, update, reset_password, set_status, delete.
// User Access: whoami, portal_list, portal_save, portal_remove.
import {
  ApiError, callerEmail, getPortalUser, handler, roleOf, serviceClient, sha256Hex, STOCK_ITEMS,
  SUPER_ADMIN_EMAIL, toAuthEmail, USERS_TABLE, WORKER_ROLE, type UserRow,
} from '../_shared/common.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const USER_ID_RE = /^[a-z0-9._-]{1,50}$/;
const PUBLIC_COLUMNS = 'id,name,email,estates,permissions,status,last_active';

function str(v: unknown, max = 200): string {
  const s = String(v ?? '').trim();
  if (!s || s.length > max) throw new ApiError('err_invalid');
  return s;
}

function password(v: unknown): string {
  const s = String(v ?? '');
  if (s.length < 6 || s.length > 200) throw new ApiError('err_invalid');
  return s;
}

async function knownEstates(): Promise<string[]> {
  const { data, error } = await serviceClient().from('opp_estates').select('name').order('name');
  if (error) throw error;
  return (data ?? []).map((r: { name: string }) => r.name);
}

async function estatesArg(v: unknown): Promise<string[]> {
  if (!Array.isArray(v) || v.length === 0) throw new ApiError('err_invalid');
  const known = new Set(await knownEstates());
  const list = [...new Set(v.map(String))];
  if (!list.every((e) => known.has(e))) throw new ApiError('err_invalid');
  return list;
}

function accessArg(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const src = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  for (const id of STOCK_ITEMS) {
    const a = src[id];
    if (a !== undefined) {
      if (a !== 'none' && a !== 'view' && a !== 'edit') throw new ApiError('err_invalid');
      out[id] = a;
    }
  }
  return out;
}

async function getWorker(id: unknown): Promise<UserRow> {
  const { data, error } = await serviceClient().from(USERS_TABLE).select(PUBLIC_COLUMNS).eq('id', Number(id)).maybeSingle();
  if (error) throw error;
  if (!data || roleOf(data as UserRow) !== WORKER_ROLE) throw new ApiError('err_invalid', 404);
  return data as UserRow;
}

async function write(q: PromiseLike<{ error: unknown }>) {
  const { error } = await q;
  if (error) throw error;
  return { ok: true };
}

/** Who is calling: Super Admin, or Intranet user with web access. */
async function authorize(req: Request) {
  const email = await callerEmail(req);
  if (!email) throw new ApiError('err_forbidden', 401);
  if (email === SUPER_ADMIN_EMAIL) return { email, name: 'HQ Admin', isSuper: true };
  const p = await getPortalUser(email);
  if (!p?.web_access) throw new ApiError('err_forbidden', 403);
  return { email, name: p.name || email, isSuper: false };
}

/** Intranet user with mobile access ↔ a linked opp_users worker row (same email, no password). */
async function syncMobileWorker(email: string, name: string, mobile: boolean, estates: string[] | null, access: Record<string, string>) {
  const db = serviceClient();
  const { data } = await db.from(USERS_TABLE).select(PUBLIC_COLUMNS).eq('email', email).maybeSingle();
  const row = data as UserRow | null;
  if (row && roleOf(row) !== WORKER_ROLE) throw new ApiError('err_exists', 409); // already an HQ / other account
  if (!mobile) {
    if (row) await write(db.from(USERS_TABLE).update({ status: 'inactive' }).eq('id', row.id));
    return;
  }
  if (!estates) throw new ApiError('err_invalid');
  const permissions = { ...(row?.permissions ?? {}), ...access, __role: WORKER_ROLE };
  if (row) await write(db.from(USERS_TABLE).update({ name, estates, permissions, status: 'active' }).eq('id', row.id));
  else await write(db.from(USERS_TABLE).insert({ id: Date.now(), name, email, password_hash: '', estates, permissions, status: 'active' }));
}

Deno.serve(handler(async (req, body) => {
  const me = await authorize(req);
  const db = serviceClient();

  switch (body.action) {
    case 'whoami':
      return me;

    case 'portal_list': {
      const [{ data, error }, linked] = await Promise.all([
        db.from('mantap_portal_users').select('*').order('name'),
        db.from(USERS_TABLE).select(PUBLIC_COLUMNS).like('email', '%@%').not('email', 'like', '%@psms.app'),
      ]);
      if (error) throw error;
      const byEmail = new Map(((linked.data ?? []) as UserRow[]).map((r) => [r.email, r]));
      return {
        users: (data ?? []).map((p: Record<string, unknown>) => {
          const w = byEmail.get(p.email as string);
          return { ...p, estates: w?.estates ?? [], permissions: w?.permissions ?? {} };
        }),
        estates: await knownEstates(),
      };
    }

    case 'portal_save': {
      const email = str(body.email, 200).toLowerCase();
      if (!EMAIL_RE.test(email) || email.endsWith('@psms.app')) throw new ApiError('err_invalid');
      const name = String(body.name ?? '').trim().slice(0, 200);
      const web = body.web === true, mobile = body.mobile === true;
      if (!me.isSuper && email === me.email && !web) throw new ApiError('err_forbidden', 403); // don't lock yourself out
      await syncMobileWorker(email, name || email, mobile, mobile ? await estatesArg(body.estates) : null, accessArg(body.access));
      return write(db.from('mantap_portal_users').upsert({
        email, name, web_access: web, mobile_access: mobile, updated_at: new Date().toISOString(),
      }));
    }

    case 'portal_remove': {
      const email = str(body.email, 200).toLowerCase();
      if (email === me.email) throw new ApiError('err_forbidden', 403);
      await syncMobileWorker(email, '', false, null, {});
      return write(db.from('mantap_portal_users').delete().eq('email', email));
    }

    case 'list': {
      const [{ data, error }, estates] = await Promise.all([
        db.from(USERS_TABLE).select(PUBLIC_COLUMNS).eq('permissions->>__role', WORKER_ROLE).order('name'),
        knownEstates(),
      ]);
      if (error) throw error;
      const workers = (data as UserRow[]).map((r) => ({
        id: r.id, name: r.name, email: r.email, estates: r.estates ?? [], permissions: r.permissions ?? {},
        status: r.status === 'inactive' ? 'inactive' : 'active', lastActive: r.last_active,
        intranet: !r.email.endsWith('@psms.app'),
      }));
      return { workers, estates };
    }

    case 'create': {
      const userId = str(body.userId, 50).toLowerCase();
      if (!USER_ID_RE.test(userId)) throw new ApiError('err_invalid');
      const email = toAuthEmail(userId);
      if (email === SUPER_ADMIN_EMAIL) throw new ApiError('err_reserved');
      const { data: existing } = await db.from(USERS_TABLE).select('id').eq('email', email).maybeSingle();
      if (existing) throw new ApiError('err_exists', 409);
      return write(db.from(USERS_TABLE).insert({
        id: Date.now(),
        name: str(body.name),
        email,
        password_hash: await sha256Hex(password(body.password)),
        estates: await estatesArg(body.estates),
        permissions: { __role: WORKER_ROLE, ...accessArg(body.access) },
        status: 'active',
      }));
    }

    case 'update': {
      const w = await getWorker(body.id);
      // Keep any other permission keys the Stock app stores; replace only module access.
      const permissions = { ...(w.permissions ?? {}), ...accessArg(body.access), __role: WORKER_ROLE };
      return write(db.from(USERS_TABLE).update({
        name: str(body.name), estates: await estatesArg(body.estates), permissions,
      }).eq('id', w.id));
    }

    case 'reset_password': {
      const w = await getWorker(body.id);
      return write(db.from(USERS_TABLE).update({ password_hash: await sha256Hex(password(body.password)) }).eq('id', w.id));
    }

    case 'set_status': {
      const w = await getWorker(body.id);
      if (body.status !== 'active' && body.status !== 'inactive') throw new ApiError('err_invalid');
      return write(db.from(USERS_TABLE).update({ status: body.status }).eq('id', w.id));
    }

    case 'delete': {
      const w = await getWorker(body.id);
      return write(db.from(USERS_TABLE).delete().eq('id', w.id));
    }
  }
  throw new ApiError('err_invalid');
}));
