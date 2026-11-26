// Worker Portal web admin. Callers: the Stock Super Admin, or an MJM Intranet
// user with web access in Mantap's User Access list (mantap_portal_users).
// Workers: list, create, update, set_details, reset_password, set_status, delete.
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

// The estate list follows the MJM Intranet companies (synced by the Stock
// project's stock-master-sync); inactive rows are hidden but their data kept.
async function knownEstates(): Promise<string[]> {
  const db = serviceClient();
  let res = await db.from('port_estates').select('name, is_active').order('sort_order').order('name');
  if (res.error) res = await db.from('port_estates').select('name').order('name'); // before the 20261123 migration
  if (res.error) throw res.error;
  return (res.data ?? []).filter((r: { is_active?: boolean }) => r.is_active !== false).map((r: { name: string }) => r.name);
}

// ── One company at a time ─────────────────────────────────────────────
// Plantation Operation (PORT) opens Worker Manage for the company chosen on its
// front page and sends that company's MJM Intranet id (company_id). Then only
// that company's locations (estates) and workers are listed and changed.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function companyArg(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return UUID_RE.test(s) ? s.toLowerCase() : null;
}
/** The locations (old estate names) of one Intranet company; the company name when none is linked. */
async function companyEstates(companyId: string): Promise<string[]> {
  const db = serviceClient();
  const { data, error } = await db.from('port_estate_company').select('estate').eq('company_id', companyId).order('estate');
  if (error) throw error;
  const list = ((data ?? []) as { estate: string }[]).map((r) => r.estate).filter(Boolean);
  if (list.length) return list;
  const { data: co } = await db.from('port_companies').select('name').eq('id', companyId).maybeSingle();
  return co?.name ? [String(co.name)] : [];
}
/** Estates a picker may offer: the company's, or (no company) every estate. */
const scopeEstates = (companyId: string | null) => (companyId ? companyEstates(companyId) : knownEstates());
const inScope = (estates: string[] | null | undefined, scope: Set<string> | null) => !scope || (estates ?? []).some((e) => scope.has(e));
/** Saving from one company keeps the person's estates of OTHER companies as they were. */
const mergeEstates = (before: string[] | null | undefined, chosen: string[], scope: Set<string> | null) =>
  scope ? [...new Set([...(before ?? []).filter((e) => !scope.has(e)), ...chosen])] : chosen;

async function estatesArg(v: unknown, companyId: string | null = null): Promise<string[]> {
  if (!Array.isArray(v) || v.length === 0) throw new ApiError('err_invalid');
  const known = new Set(await scopeEstates(companyId));
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
async function authorize(req: Request, companyId: string | null = null) {
  const email = await callerEmail(req);
  if (!email) throw new ApiError('err_forbidden', 401);
  if (email === SUPER_ADMIN_EMAIL) return { email, name: 'HQ Admin', isSuper: true };
  const p = await getPortalUser(email);
  if (p?.web_access) return { email, name: p.name || email, isSuper: false };
  // A Plantation Operation (PORT) Admin or Super Admin opens Worker Manage from PORT
  const { data } = await serviceClient().from(USERS_TABLE).select('name, permissions, status').eq('email', email).maybeSingle();
  const row = data as (UserRow & { permissions?: Record<string, unknown> }) | null;
  const role = row ? roleOf(row) : '';
  if (row && row.status !== 'inactive' && (role === 'admin' || role === 'superadmin')) {
    return { email, name: row.name || email, isSuper: role === 'superadmin' };
  }
  // Admin of this company in PORT → User Access (set per company)
  if (row && row.status !== 'inactive' && companyId) {
    const { data: acc } = await serviceClient().from('port_user_company_access')
      .select('role, status').eq('email', email.toLowerCase()).eq('company_id', companyId).maybeSingle();
    if (acc && acc.role === 'admin' && acc.status !== 'inactive') return { email, name: row.name || email, isSuper: false };
  }
  throw new ApiError('err_forbidden', 403);
}

/** Intranet user with mobile access ↔ a linked port_users worker row (same email, no password). */
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
  const companyId = companyArg(body.company_id);
  const me = await authorize(req, companyId);
  const db = serviceClient();
  const scope = companyId ? new Set(await companyEstates(companyId)) : null;
  /** A worker of another company cannot be changed from this company. */
  const mine = async (id: unknown) => {
    const w = await getWorker(id);
    if (!inScope(w.estates, scope)) throw new ApiError('err_forbidden', 403);
    return w;
  };

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
      // One company: the people the Intranet gave this company, or who work on its estates
      let given: Set<string> | null = null;
      if (companyId) {
        const { data: uc } = await db.from('port_user_companies').select('email').eq('company_id', companyId);
        given = new Set(((uc ?? []) as { email: string }[]).map((r) => r.email.toLowerCase()));
      }
      return {
        users: (data ?? []).map((p: Record<string, unknown>) => {
          const w = byEmail.get(p.email as string);
          return { ...p, estates: (w?.estates ?? []).filter((e) => !scope || scope.has(e)), permissions: w?.permissions ?? {} };
        }).filter((p: Record<string, unknown>) => !given || given.has(String(p.email).toLowerCase()) || inScope(byEmail.get(p.email as string)?.estates, scope)),
        estates: await scopeEstates(companyId),
      };
    }

    case 'portal_save': {
      const email = str(body.email, 200).toLowerCase();
      if (!EMAIL_RE.test(email) || email.endsWith('@psms.app')) throw new ApiError('err_invalid');
      const name = String(body.name ?? '').trim().slice(0, 200);
      const web = body.web === true, mobile = body.mobile === true;
      if (!me.isSuper && email === me.email && !web) throw new ApiError('err_forbidden', 403); // don't lock yourself out
      let estates: string[] | null = null;
      if (mobile) {
        const { data: before } = await db.from(USERS_TABLE).select('estates').eq('email', email).maybeSingle();
        estates = mergeEstates((before as { estates?: string[] } | null)?.estates, await estatesArg(body.estates, companyId), scope);
      }
      await syncMobileWorker(email, name || email, mobile, estates, accessArg(body.access));
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
        scopeEstates(companyId),
      ]);
      if (error) throw error;
      // Worker details kept by PORT → Worker list (gender, type, …); empty before the 20261129 SQL
      const details = new Map<number, Record<string, unknown>>();
      {
        const { data: d } = await db.from('port_worker_details').select('*');
        for (const x of (d ?? []) as Record<string, unknown>[]) details.set(Number(x.user_id), x);
      }
      // One company: only its workers, with only its estates shown
      const workers = (data as UserRow[]).filter((r) => inScope(r.estates, scope)).map((r) => ({
        gender: String(details.get(r.id)?.gender ?? ''), workerType: String(details.get(r.id)?.worker_type ?? ''),
        id: r.id, name: r.name, email: r.email, estates: (r.estates ?? []).filter((e) => !scope || scope.has(e)), permissions: r.permissions ?? {},
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
        estates: await estatesArg(body.estates, companyId),
        permissions: { __role: WORKER_ROLE, ...accessArg(body.access) },
        status: 'active',
      }));
    }

    case 'update': {
      const w = await mine(body.id);
      // Keep any other permission keys the Stock app stores; replace only module access.
      const permissions = { ...(w.permissions ?? {}), ...accessArg(body.access), __role: WORKER_ROLE };
      return write(db.from(USERS_TABLE).update({
        name: str(body.name), estates: mergeEstates(w.estates, await estatesArg(body.estates, companyId), scope), permissions,
      }).eq('id', w.id));
    }

    case 'set_details': {
      // PORT → Worker list: gender and type (more columns later)
      const w = await mine(body.id);
      const gender = String(body.gender ?? '');
      const workerType = String(body.workerType ?? '');
      if (!['', 'male', 'female'].includes(gender) || !['', 'local', 'foreign'].includes(workerType)) throw new ApiError('err_invalid');
      return write(db.from('port_worker_details').upsert({
        user_id: w.id, gender, worker_type: workerType, updated_by: me.email, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }));
    }

    case 'reset_password': {
      const w = await mine(body.id);
      return write(db.from(USERS_TABLE).update({ password_hash: await sha256Hex(password(body.password)) }).eq('id', w.id));
    }

    case 'set_status': {
      const w = await mine(body.id);
      if (body.status !== 'active' && body.status !== 'inactive') throw new ApiError('err_invalid');
      return write(db.from(USERS_TABLE).update({ status: body.status }).eq('id', w.id));
    }

    case 'delete': {
      const w = await mine(body.id);
      return write(db.from(USERS_TABLE).delete().eq('id', w.id));
    }
  }
  throw new ApiError('err_invalid');
}));
