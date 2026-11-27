// Worker Portal web admin. Callers: the Stock Super Admin, or an MJM Intranet
// user with web access in Mantap's User Access list (mantap_portal_users).
// Workers: list, create, update, set_details, reset_password, set_status, delete.
// User Access: whoami, portal_list, portal_save, portal_remove.
import {
  ApiError, callerEmail, lockPin, unlockPin, getPortalUser, handler, roleOf, serviceClient, sha256Hex, STOCK_ITEMS,
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

// ── The caller's companies and each company's Locations (as set in the Intranet) ──
const INTRANET_URL = Deno.env.get('INTRANET_SUPABASE_URL') ?? 'https://briqzyxfxsvulyizzbiu.supabase.co';
const INTRANET_KEY = Deno.env.get('INTRANET_MODULE_API_KEY') ?? '';
interface IntranetLoc { company_id: string; group_id?: string | null; name: string; sort_order: number | null; is_active: boolean }
let mdCache: { at: number; locations: IntranetLoc[]; businesses: { id: string }[] } | null = null;
async function intranetLocations(): Promise<{ locations: IntranetLoc[]; businesses: { id: string }[] }> {
  if (mdCache && Date.now() - mdCache.at < 10 * 60 * 1000) return mdCache;
  if (!INTRANET_KEY) return { locations: [], businesses: [] };
  try {
    const res = await fetch(`${INTRANET_URL}/functions/v1/gw-master-data`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gw-api-key': INTRANET_KEY }, body: '{}' });
    if (!res.ok) return { locations: [], businesses: [] };
    const md = await res.json();
    mdCache = { at: Date.now(), locations: md.locations ?? [], businesses: md.businesses ?? [] };
    return mdCache;
  } catch { return { locations: [], businesses: [] }; }
}
async function myCompanies(email: string, all = false): Promise<{ companies: { id: string; name: string }[]; locations: Record<string, string[]> }> {
  const db = serviceClient();
  // The companies the Intranet gave this person (saved at each Intranet sign-in), plus the
  // companies set for them in PORT → User Access. The Super Admin: every company.
  const who = email.toLowerCase();
  const [{ data: uc }, { data: ua }] = await Promise.all([
    db.from('port_user_companies').select('company_id').eq('email', who),
    db.from('port_user_company_access').select('company_id, status').eq('email', who),
  ]);
  const ids = [...new Set([
    ...((uc ?? []) as { company_id: string }[]).map((r) => r.company_id),
    ...((ua ?? []) as { company_id: string; status: string }[]).filter((r) => r.status !== 'inactive').map((r) => r.company_id),
  ])];
  if (!ids.length && !all) return { companies: [], locations: {} };
  let cq = db.from('port_companies').select('id, code, name, is_active');
  if (!all) cq = cq.in('id', ids);
  const { data: cos } = await cq.order('code').order('name');
  const companies = ((cos ?? []) as { id: string; name: string; is_active: boolean }[]).filter((c) => c.is_active !== false).map((c) => ({ id: c.id, name: c.name }));
  const md = await intranetLocations();
  const bizOrder = new Map(md.businesses.map((b, i) => [b.id, i]));
  const locations: Record<string, string[]> = {};
  for (const c of companies) {
    const out: string[] = [];
    md.locations.filter((l) => l.company_id === c.id && l.is_active !== false)
      .sort((a, b) => ((a.group_id && bizOrder.get(a.group_id)) ?? 1e6) - ((b.group_id && bizOrder.get(b.group_id)) ?? 1e6) || (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
      .forEach((l) => { const n = l.name.trim(); if (n && !out.includes(n)) out.push(n); });
    locations[c.id] = out;
  }
  return { companies, locations };
}

/** Who is calling: Super Admin, or Intranet user with web access. */
async function authorize(req: Request, companyId: string | null = null) {
  const email = await callerEmail(req);
  if (!email) throw new ApiError('err_forbidden', 401);
  if (email === SUPER_ADMIN_EMAIL) {
    // The name saved for this email in PORT → User Access (e.g. the person using it), else 'HQ Admin'
    const { data: sa } = await serviceClient().from(USERS_TABLE).select('name').eq('email', email).maybeSingle();
    return { email, name: (sa as { name?: string } | null)?.name?.trim() || 'HQ Admin', isSuper: true };
  }
  const p = await getPortalUser(email);
  if (p?.web_access) return { email, name: p.name || email, isSuper: false };
  // A Plantation Operation (PORT) Admin or Super Admin opens Worker Manage from PORT
  const { data } = await serviceClient().from(USERS_TABLE).select('name, permissions, status').eq('email', email).maybeSingle();
  const row = data as (UserRow & { permissions?: Record<string, unknown> }) | null;
  const role = row ? roleOf(row) : '';
  if (row && row.status !== 'inactive' && (role === 'admin' || role === 'superadmin')) {
    return { email, name: row.name || email, isSuper: role === 'superadmin' };
  }
  // PORT → User Access: an Admin, or Worker list (Worker Manage) = View / Edit. Set per
  // company; a company without its own row uses the person's general access (as in PORT).
  // No company given (e.g. the Mantap mobile view asking who this is): any of their companies.
  if (row && row.status !== 'inactive') {
    const level = (r: string, p: Record<string, unknown> | null | undefined): 'edit' | 'view' | null => {
      if (r === 'admin' || r === 'superadmin') return 'edit';
      const w = p?.workers;
      return w === 'edit' ? 'edit' : w === 'view' ? 'view' : null;
    };
    let q = serviceClient().from('port_user_company_access').select('company_id, role, status, permissions').eq('email', email.toLowerCase());
    if (companyId) q = q.eq('company_id', companyId);
    const { data: accs } = await q;
    const rows = (accs ?? []) as { company_id: string; role: string; status: string; permissions: Record<string, unknown> | null }[];
    const general = level(role, row.permissions as Record<string, unknown> | undefined);
    let best: 'edit' | 'view' | null = null;
    if (companyId) {
      const acc = rows[0];
      best = acc ? (acc.status === 'inactive' ? null : level(acc.role, acc.permissions)) : general;
    } else {
      const lv = [general, ...rows.filter((a) => a.status !== 'inactive').map((a) => level(a.role, a.permissions))];
      best = lv.includes('edit') ? 'edit' : lv.includes('view') ? 'view' : null;
    }
    if (best === 'edit') return { email, name: row.name || email, isSuper: false };
    if (best === 'view') return { email, name: row.name || email, isSuper: false, viewOnly: true };
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

/** Keeps the locked, readable copy of a worker's PIN (needs the 20261130 SQL; skipped before it). */
async function keepPin(userId: number, pin: string) {
  try {
    const { error } = await serviceClient().from('port_worker_details')
      .upsert({ user_id: userId, pin_locked: await lockPin(pin) }, { onConflict: 'user_id' });
    if (error) console.warn('[mantap-worker-admin] PIN copy skipped:', error.message);
  } catch (e) { console.warn('[mantap-worker-admin] PIN copy skipped:', e instanceof Error ? e.message : e); }
}

Deno.serve(handler(async (req, body) => {
  const companyId = companyArg(body.company_id);
  const me: { email: string; name: string; isSuper: boolean; viewOnly?: boolean } = await authorize(req, companyId);
  const db = serviceClient();
  // View only (Worker list = View in PORT → User Access): reading is allowed, changing is not
  if (me.viewOnly && !['whoami', 'list', 'portal_list'].includes(String(body.action))) throw new ApiError('err_forbidden', 403);
  // The company's locations: its old estate names, plus its MJM Intranet Locations
  // as PORT sends them (body.locations), plus the company name itself
  const intranetLocs = Array.isArray(body.locations) ? body.locations.map((x: unknown) => String(x ?? '').trim()).filter((x: string) => x && x.length <= 100).slice(0, 200) : [];
  const scope = companyId ? new Set([...await companyEstates(companyId), ...intranetLocs]) : null;
  if (companyId && scope) {
    const { data: co } = await serviceClient().from('port_companies').select('name').eq('id', companyId).maybeSingle();
    if (co?.name) scope.add(String(co.name));
  }
  /** A worker of another company cannot be changed from this company. */
  const mine = async (id: unknown) => {
    const w = await getWorker(id);
    if (!inScope(w.estates, scope)) throw new ApiError('err_forbidden', 403);
    return w;
  };

  switch (body.action) {
    case 'whoami':
      return { ...me, ...(await myCompanies(me.email, me.isSuper)) };

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
        workerNo: String(details.get(r.id)?.worker_no ?? ''), opisproId: String(details.get(r.id)?.opispro_id ?? ''),
        pinReadable: !!details.get(r.id)?.pin_locked,
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
      const newId = Date.now();
      const pin = password(body.password);
      await write(db.from(USERS_TABLE).insert({
        id: newId,
        name: str(body.name),
        email,
        password_hash: await sha256Hex(pin),
        estates: await estatesArg(body.estates, companyId),
        permissions: { __role: WORKER_ROLE, ...accessArg(body.access) },
        status: 'active',
      }));
      await keepPin(newId, pin);
      return { ok: true };
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
      // PORT → Worker list: gender, type, Worker ID, Opispro Worker ID (more later)
      const w = await mine(body.id);
      const gender = String(body.gender ?? '');
      const workerType = String(body.workerType ?? '');
      if (!['', 'male', 'female'].includes(gender) || !['', 'local', 'foreign'].includes(workerType)) throw new ApiError('err_invalid');
      // Location (one of the company's Intranet Locations): replaces the worker's
      // location in this company; their estates in other companies stay
      if (body.location !== undefined) {
        const loc = String(body.location ?? '').trim();
        if (!loc || !intranetLocs.includes(loc)) throw new ApiError('err_invalid');
        const estates = mergeEstates(w.estates, [loc], scope);
        await write(db.from(USERS_TABLE).update({ estates }).eq('id', w.id));
      }
      const row: Record<string, unknown> = { user_id: w.id, gender, worker_type: workerType, updated_by: me.email, updated_at: new Date().toISOString() };
      for (const [k, col] of [['workerNo', 'worker_no'], ['opisproId', 'opispro_id']] as const) {
        if (body[k] === undefined) continue;
        const v = String(body[k] ?? '').trim();
        if (v.length > 50) throw new ApiError('err_invalid');
        row[col] = v;
      }
      return write(db.from('port_worker_details').upsert(row, { onConflict: 'user_id' }));
    }

    case 'reveal_pin': {
      // PORT → Worker list, eye button (Edit access only; View-only is refused above)
      const w = await mine(body.id);
      const { data: d } = await db.from('port_worker_details').select('pin_locked').eq('user_id', w.id).maybeSingle();
      const pin = await unlockPin((d as { pin_locked?: string } | null)?.pin_locked);
      console.log('[mantap-worker-admin] PIN shown', w.id, 'to', me.email, pin ? 'ok' : 'not available');
      return { pin };
    }

    case 'reset_password': {
      const w = await mine(body.id);
      const pin = password(body.password);
      await write(db.from(USERS_TABLE).update({ password_hash: await sha256Hex(pin) }).eq('id', w.id));
      await keepPin(w.id, pin);
      return { ok: true };
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
