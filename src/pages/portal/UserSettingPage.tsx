import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { PortalMe } from '../../lib/auth';
import { useErrorText, useI18n } from '../../lib/i18n';
import { STOCK_SECTIONS, stockAccess } from '../../lib/modules';
import type { Worker } from '../../lib/types';
import {
  removePortalUser, deleteWorker, listPortalUsers, listWorkers, resetWorkerPassword, setWorkerStatus, type PortalUser,
} from '../../lib/workers';
import { PortalUserDialog } from './PortalUserDialog';
import { WorkerDialog } from './WorkerDialog';
import { toUserId } from './WorkersPage';

/** User Setting: every account and its role.
 *   Admin  — MJM Intranet users; they arrive from the Intranet without a password
 *            and see this web portal (and the Mobile View).
 *   Worker — sign in on the phone with User ID + password and go straight to
 *            the mobile app. Added, edited and deactivated here. */
export function UserSettingPage() {
  const { t, lang } = useI18n();
  const me = useOutletContext<PortalMe>();
  const errorText = useErrorText();
  const [users, setUsers] = useState<PortalUser[] | null>(null);
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [estates, setEstates] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [editingUser, setEditingUser] = useState<PortalUser | null | undefined>(undefined);
  const [editingWorker, setEditingWorker] = useState<Worker | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const [p, w] = await Promise.all([listPortalUsers(), listWorkers()]);
      setUsers(p.users);
      setEstates(p.estates);
      setWorkers(w.workers.filter((x) => !x.intranet));
      setError('');
    } catch (e) {
      setError(errorText(e));
    }
  }, [errorText]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); await load(); } catch (e) { alert(errorText(e)); }
  };
  const yesNo = (on: boolean) => <span className={`pill ${on ? 'on' : 'off'}`}>{on ? '✓' : '—'}</span>;

  const s = q.trim().toLowerCase();
  const adminList = useMemo(() => (users ?? []).filter((u) => !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)), [users, s]);
  const workerList = useMemo(() => (workers ?? []).filter((w) => !s || w.name.toLowerCase().includes(s) || toUserId(w.email).includes(s)), [workers, s]);

  function resetPassword(w: Worker) {
    const pw = prompt(`${t('new_password')} — ${w.name}`);
    if (pw == null) return;
    if (pw.length < 6) { alert(t('pw_short')); return; }
    run(async () => { await resetWorkerPassword(w.id, pw); alert(t('saved')); });
  }

  return (
    <section className="stack">
      {error && <p className="err">{error}</p>}
      <div className="tools">
        <input className="input" placeholder={t('search_users')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* ── Admin role ── */}
      <div>
        <div className="tools">
          <div style={{ flex: 1 }}>
            <h2 className="h2"><span className="pill role-admin">{t('role_admin')}</span> {t('users_admin')}</h2>
            <p className="muted small">{t('users_admin_sub')}</p>
          </div>
          <button className="btn primary" type="button" onClick={() => setEditingUser(null)}>{t('add_user')}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('col_name')}</th><th>Email</th><th>{t('col_role')}</th><th>{t('web')}</th><th>{t('mobile')}</th><th>{t('col_estates')}</th><th /></tr></thead>
            <tbody id="portalRows">
              {users === null && !error && <tr><td colSpan={7} className="muted">{t('loading')}</td></tr>}
              {users !== null && adminList.length === 0 && <tr><td colSpan={7} className="muted">{t('no_users')}</td></tr>}
              {adminList.map((u) => (
                <tr key={u.email}>
                  <td><strong>{u.name || '—'}</strong>{u.email === me.email && <span className="muted"> ({t('you')})</span>}</td>
                  <td>{u.email}</td>
                  <td><span className="pill role-admin">{t('role_admin')}</span></td>
                  <td>{yesNo(u.web_access)}</td>
                  <td>{yesNo(u.mobile_access)}</td>
                  <td>{u.mobile_access && u.estates.length ? u.estates.map((n) => <span key={n} className="pill est">{n}</span>) : <span className="muted">—</span>}</td>
                  <td>
                    <div className="acts">
                      <button className="btn sm" type="button" onClick={() => setEditingUser(u)}>{t('edit')}</button>
                      {u.email !== me.email && (
                        <button className="btn sm danger" type="button" onClick={() => confirm(t('confirm_remove')) && run(() => removePortalUser(u.email))}>{t('remove')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Worker role ── */}
      <div>
        <div className="tools">
          <div style={{ flex: 1 }}>
            <h2 className="h2"><span className="pill role-worker">{t('role_worker')}</span> {t('users_workers')}</h2>
            <p className="muted small">{t('users_workers_sub')}</p>
          </div>
          <button className="btn primary" type="button" onClick={() => setEditingWorker(null)}>{t('add_worker')}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('col_name')}</th><th>{t('col_id')}</th><th>{t('col_role')}</th><th>{t('col_estates')}</th>
                <th>{t('col_access')}</th><th>{t('col_status')}</th><th />
              </tr>
            </thead>
            <tbody id="workerRows">
              {workers === null && !error && <tr><td colSpan={7} className="muted">{t('loading')}</td></tr>}
              {workers !== null && workerList.length === 0 && <tr><td colSpan={7} className="muted">{t('no_workers')}</td></tr>}
              {workerList.map((w) => {
                const active = w.status !== 'inactive';
                const access = STOCK_SECTIONS.filter((x) => stockAccess(w.permissions, x.id) !== 'none');
                return (
                  <tr key={w.id}>
                    <td><strong>{w.name}</strong></td>
                    <td>{toUserId(w.email)}</td>
                    <td><span className="pill role-worker">{t('role_worker')}</span></td>
                    <td>{w.estates.length ? w.estates.map((n) => <span key={n} className="pill est">{n}</span>) : <span className="muted">—</span>}</td>
                    <td>
                      {access.length ? access.map((x) => {
                        const a = stockAccess(w.permissions, x.id);
                        return <span key={x.id} className={`pill ${a}`} title={t(a === 'edit' ? 'edit_access' : 'view')}>{x.icon} {x.label[lang]}</span>;
                      }) : <span className="muted">{t('none')}</span>}
                    </td>
                    <td><span className={`pill ${active ? 'on' : 'off'}`}>{t(active ? 'active' : 'inactive')}</span></td>
                    <td>
                      <div className="acts">
                        <button className="btn sm" type="button" onClick={() => setEditingWorker(w)}>{t('edit')}</button>
                        <button className="btn sm" type="button" onClick={() => resetPassword(w)}>{t('reset_pw')}</button>
                        <button className="btn sm" type="button" onClick={() => run(() => setWorkerStatus(w.id, active ? 'inactive' : 'active'))}>
                          {t(active ? 'deactivate' : 'activate')}
                        </button>
                        <button className="btn sm danger" type="button" onClick={() => confirm(t('confirm_delete')) && run(() => deleteWorker(w.id))}>{t('delete')}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser !== undefined && (
        <PortalUserDialog user={editingUser} estates={estates} isSelf={editingUser?.email === me.email}
          onClose={() => setEditingUser(undefined)} onSaved={() => { setEditingUser(undefined); load(); }} />
      )}
      {editingWorker !== undefined && (
        <WorkerDialog worker={editingWorker} estates={estates} onClose={() => setEditingWorker(undefined)} onSaved={() => { setEditingWorker(undefined); load(); }} />
      )}
    </section>
  );
}
