import { useCallback, useEffect, useMemo, useState } from 'react';
import { useErrorText, useI18n } from '../../lib/i18n';
import { STOCK_SECTIONS, stockAccess } from '../../lib/modules';
import type { Worker } from '../../lib/types';
import { deleteWorker, listWorkers, resetWorkerPassword, setWorkerStatus } from '../../lib/workers';
import { WorkerDialog } from './WorkerDialog';

export const toUserId = (email: string) => email.replace(/@psms\.app$/, '');

export function WorkersPage() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [estates, setEstates] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [estate, setEstate] = useState('');
  // undefined = closed, null = new worker, Worker = edit
  const [editing, setEditing] = useState<Worker | null | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const r = await listWorkers();
      setWorkers(r.workers);
      setEstates(r.estates);
      setLoadError('');
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [errorText]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (workers ?? []).filter((w) =>
      (!s || w.name.toLowerCase().includes(s) || toUserId(w.email).includes(s)) &&
      (!estate || w.estates.includes(estate)));
  }, [workers, q, estate]);

  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); await load(); } catch (e) { alert(errorText(e)); }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  function resetPassword(w: Worker) {
    const pw = prompt(`${t('new_password')} — ${w.name}`);
    if (pw == null) return;
    if (pw.length < 6) { alert(t('pw_short')); return; }
    run(async () => { await resetWorkerPassword(w.id, pw); alert(t('saved')); });
  }

  return (
    <section>
      <div className="tools">
        <input className="input" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={estate} onChange={(e) => setEstate(e.target.value)}>
          <option value="">{t('all_estates')}</option>
          {estates.map((n) => <option key={n}>{n}</option>)}
        </select>
        <span className="count">{list.length} {t('workers_count')}</span>
        <button className="btn primary" type="button" onClick={() => setEditing(null)}>{t('add_worker')}</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t('col_name')}</th><th>{t('col_id')}</th><th>{t('col_estates')}</th>
              <th>{t('col_access')}</th><th>{t('col_status')}</th><th>{t('col_last')}</th><th />
            </tr>
          </thead>
          <tbody id="rows">
            {loadError && <tr><td colSpan={7} className="err">{loadError}</td></tr>}
            {!loadError && workers === null && <tr><td colSpan={7} className="muted">{t('loading')}</td></tr>}
            {workers !== null && list.length === 0 && <tr><td colSpan={7} className="muted">{t('no_workers')}</td></tr>}
            {list.map((w) => {
              const active = w.status !== 'inactive';
              const access = STOCK_SECTIONS.filter((s) => stockAccess(w.permissions, s.id) !== 'none');
              return (
                <tr key={w.id}>
                  <td><strong>{w.name}</strong></td>
                  <td>{toUserId(w.email)}</td>
                  <td>{w.estates.length ? w.estates.map((n) => <span key={n} className="pill est">{n}</span>) : <span className="muted">—</span>}</td>
                  <td>
                    {access.length ? access.map((s) => {
                      const a = stockAccess(w.permissions, s.id);
                      return <span key={s.id} className={`pill ${a}`} title={t(a === 'edit' ? 'edit_access' : 'view')}>{s.icon} {s.label[lang]}</span>;
                    }) : <span className="muted">{t('none')}</span>}
                  </td>
                  <td><span className={`pill ${active ? 'on' : 'off'}`}>{t(active ? 'active' : 'inactive')}</span></td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(w.lastActive)}</td>
                  <td>
                    <div className="acts">
                      <button className="btn sm" type="button" onClick={() => setEditing(w)}>{t('edit')}</button>
                      <button className="btn sm" type="button" onClick={() => resetPassword(w)}>{t('reset_pw')}</button>
                      <button className="btn sm" type="button" onClick={() => run(() => setWorkerStatus(w.id, active ? 'inactive' : 'active'))}>
                        {t(active ? 'deactivate' : 'activate')}
                      </button>
                      <button className="btn sm danger" type="button" onClick={() => confirm(t('confirm_delete')) && run(() => deleteWorker(w.id))}>
                        {t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing !== undefined && (
        <WorkerDialog worker={editing} estates={estates} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); }} />
      )}
    </section>
  );
}
