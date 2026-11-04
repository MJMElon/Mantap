import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { PortalMe } from '../../lib/auth';
import { useErrorText, useI18n } from '../../lib/i18n';
import type { Worker } from '../../lib/types';
import { listPortalUsers, listWorkers, removePortalUser, setWorkerStatus, type PortalUser } from '../../lib/workers';
import { PortalUserDialog } from './PortalUserDialog';
import { toUserId } from './WorkersPage';

/** User Access: who may use the Worker Portal on web and mobile. */
export function AccessPage() {
  const { t } = useI18n();
  const me = useOutletContext<PortalMe>();
  const errorText = useErrorText();
  const [users, setUsers] = useState<PortalUser[] | null>(null);
  const [estates, setEstates] = useState<string[]>([]);
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<PortalUser | null | undefined>(undefined);

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

  return (
    <section className="stack">
      {error && <p className="err">{error}</p>}

      <div>
        <div className="tools">
          <div style={{ flex: 1 }}>
            <h2 className="h2">{t('access_intranet')}</h2>
            <p className="muted small">{t('access_intranet_sub')}</p>
          </div>
          <button className="btn primary" type="button" onClick={() => setEditing(null)}>{t('add_user')}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('col_name')}</th><th>Email</th><th>{t('web')}</th><th>{t('mobile')}</th><th>{t('col_estates')}</th><th /></tr></thead>
            <tbody id="portalRows">
              {users === null && !error && <tr><td colSpan={6} className="muted">{t('loading')}</td></tr>}
              {users?.length === 0 && <tr><td colSpan={6} className="muted">{t('no_users')}</td></tr>}
              {users?.map((u) => (
                <tr key={u.email}>
                  <td><strong>{u.name || '—'}</strong>{u.email === me.email && <span className="muted"> ({t('you')})</span>}</td>
                  <td>{u.email}</td>
                  <td>{yesNo(u.web_access)}</td>
                  <td>{yesNo(u.mobile_access)}</td>
                  <td>{u.mobile_access && u.estates.length ? u.estates.map((n) => <span key={n} className="pill est">{n}</span>) : <span className="muted">—</span>}</td>
                  <td>
                    <div className="acts">
                      <button className="btn sm" type="button" onClick={() => setEditing(u)}>{t('edit')}</button>
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

      <div>
        <h2 className="h2">{t('access_workers')}</h2>
        <p className="muted small">{t('access_workers_sub')}</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('col_name')}</th><th>{t('col_id')}</th><th>{t('mobile')}</th><th /></tr></thead>
            <tbody id="workerAccessRows">
              {workers === null && !error && <tr><td colSpan={4} className="muted">{t('loading')}</td></tr>}
              {workers?.length === 0 && <tr><td colSpan={4} className="muted">{t('no_workers')}</td></tr>}
              {workers?.map((w) => {
                const on = w.status !== 'inactive';
                return (
                  <tr key={w.id}>
                    <td><strong>{w.name}</strong></td>
                    <td>{toUserId(w.email)}</td>
                    <td>{yesNo(on)}</td>
                    <td>
                      <button className="btn sm" type="button" onClick={() => run(() => setWorkerStatus(w.id, on ? 'inactive' : 'active'))}>
                        {t(on ? 'deactivate' : 'activate')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editing !== undefined && (
        <PortalUserDialog user={editing} estates={estates} isSelf={editing?.email === me.email}
          onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />
      )}
    </section>
  );
}
