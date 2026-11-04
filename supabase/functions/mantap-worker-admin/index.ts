// Worker management for the Mantap admin. Only the Super Admin may call it.
// Actions: list, create, update, reset_password, set_status, delete.
import {
  ApiError, callerEmail, handler, roleOf, serviceClient, sha256Hex, STOCK_ITEMS,
  SUPER_ADMIN_EMAIL, toAuthEmail, USERS_TABLE, WORKER_ROLE, type UserRow,
} from '../_shared/common.ts';

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

Deno.serve(handler(async (req, body) => {
  if ((await callerEmail(req)) !== SUPER_ADMIN_EMAIL) throw new ApiError('err_forbidden', 403);
  const db = serviceClient();

  switch (body.action) {
    case 'list': {
      const [{ data, error }, estates] = await Promise.all([
        db.from(USERS_TABLE).select(PUBLIC_COLUMNS).eq('permissions->>__role', WORKER_ROLE).order('name'),
        knownEstates(),
      ]);
      if (error) throw error;
      const workers = (data as UserRow[]).map((r) => ({
        id: r.id, name: r.name, email: r.email, estates: r.estates ?? [], permissions: r.permissions ?? {},
        status: r.status === 'inactive' ? 'inactive' : 'active', lastActive: r.last_active,
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
