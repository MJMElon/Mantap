/* Mantap Worker Portal — sign-in and worker accounts.
   Same account rules as the Stock app: workers are rows in opp_users
   (role estate_user, SHA-256 password hash); the Super Admin signs in
   through Supabase Auth. */
const C = window.MANTAP_CONFIG;
window.db = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);

function toAuthEmail(userId) { return userId.includes('@') ? userId : userId + '@psms.app'; }
function toUserId(email) { return (email || '').replace(/@psms\.app$/, ''); }

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// opp_users row <-> worker object (role lives in permissions.__role, as in the Stock app)
function rowToUser(row) {
  const perms = (row.permissions && typeof row.permissions === 'object' && !Array.isArray(row.permissions)) ? row.permissions : {};
  return {
    id: row.id, name: row.name, email: row.email, passwordHash: row.password_hash,
    estates: row.estates || [], permissions: perms, role: perms.__role || 'user',
    status: row.status || 'active', lastActive: row.last_active || null,
  };
}

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)) || null; } catch (e) { return null; } }
function writeJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

const WorkerSession = {
  get: () => readJSON(C.WORKER_SESSION_KEY),
  set: (s) => writeJSON(C.WORKER_SESSION_KEY, s),
  clear: () => localStorage.removeItem(C.WORKER_SESSION_KEY),
};
const AdminSession = {
  get: () => readJSON(C.ADMIN_SESSION_KEY),
  set: (s) => writeJSON(C.ADMIN_SESSION_KEY, s),
  clear: () => localStorage.removeItem(C.ADMIN_SESSION_KEY),
};

async function fetchUserByEmail(email) {
  const { data, error } = await db.from(C.USERS_TABLE).select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data ? rowToUser(data) : null;
}

function workerSessionFrom(user, prev) {
  return {
    id: user.id, email: user.email, name: user.name, estates: user.estates || [],
    estate: (prev && prev.estate && (user.estates || []).includes(prev.estate)) ? prev.estate : '',
    role: user.role, permissions: user.permissions || {},
  };
}

// Returns { kind: 'worker' | 'admin' } or throws Error(i18nKey)
async function signIn(rawId, password) {
  rawId = (rawId || '').trim().toLowerCase();
  if (!rawId) throw new Error('err_empty_id');
  if (!password) throw new Error('err_empty_pw');

  if (rawId === C.SUPER_ADMIN_EMAIL) {
    const { error } = await db.auth.signInWithPassword({ email: rawId, password });
    if (error) throw new Error('err_wrong');
    AdminSession.set({ email: rawId, name: 'HQ Admin', role: 'superadmin' });
    return { kind: 'admin' };
  }

  let user;
  try { user = await fetchUserByEmail(toAuthEmail(rawId)); }
  catch (e) { console.error(e); throw new Error('err_network'); }
  if (!user) throw new Error('err_not_found');
  if (!user.passwordHash || user.passwordHash !== await sha256Hex(password)) throw new Error('err_wrong');
  if (user.status === 'inactive') throw new Error('err_inactive');
  if (user.role !== 'estate_user') throw new Error('err_not_worker');

  WorkerSession.set(workerSessionFrom(user, null));
  db.from(C.USERS_TABLE).update({ last_active: new Date().toISOString() }).eq('id', user.id).then(() => {}, () => {});
  return { kind: 'worker' };
}

// Re-read the signed-in worker from the database (permissions / estates / status may have changed).
async function refreshWorker() {
  const s = WorkerSession.get();
  if (!s) return null;
  try {
    const user = await fetchUserByEmail(s.email);
    if (!user || user.status === 'inactive' || user.role !== 'estate_user') { WorkerSession.clear(); return null; }
    const fresh = workerSessionFrom(user, s);
    WorkerSession.set(fresh);
    return fresh;
  } catch (e) {
    return s; // offline: keep the cached session
  }
}

function signOutWorker() { WorkerSession.clear(); }
async function signOutAdmin() { AdminSession.clear(); try { await db.auth.signOut(); } catch (e) {} }

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
