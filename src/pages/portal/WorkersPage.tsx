import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useErrorText, useI18n } from '../../lib/i18n';
import { STOCK_SECTIONS, stockAccess } from '../../lib/modules';
import type { Worker } from '../../lib/types';
import { portCompany } from '../../lib/auth';
import { listWorkers } from '../../lib/workers';

export const toUserId = (email: string) => email.replace(/@psms\.app$/, '');

export function fmtDateTime(iso: string | null, lang: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Worker Manage: the worker list, view only. Accounts are changed in User Setting. */
export function WorkersPage() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [estates, setEstates] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [estate, setEstate] = useState('');

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

  return (
    <section>
      <div className="tools">
        {portCompany() && <span className="pill est" title="Company chosen in Plantation Operation">🏢 {portCompany()!.name}</span>}
        <input className="input" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={estate} onChange={(e) => setEstate(e.target.value)}>
          <option value="">{t('all_estates')}</option>
          {estates.map((n) => <option key={n}>{n}</option>)}
        </select>
        <span className="count">{list.length} {t('workers_count')}</span>
        <Link className="btn sm" to="/portal/users">{t('manage_accounts')}</Link>
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
                  <td><strong>{w.name}</strong>{w.intranet && <> <span className="pill view">{t('intranet_badge')}</span></>}</td>
                  <td>{toUserId(w.email)}</td>
                  <td>{w.estates.length ? w.estates.map((n) => <span key={n} className="pill est">{n}</span>) : <span className="muted">—</span>}</td>
                  <td>
                    {access.length ? access.map((s) => {
                      const a = stockAccess(w.permissions, s.id);
                      return <span key={s.id} className={`pill ${a}`} title={t(a === 'edit' ? 'edit_access' : 'view')}>{s.icon} {s.label[lang]}</span>;
                    }) : <span className="muted">{t('none')}</span>}
                  </td>
                  <td><span className={`pill ${active ? 'on' : 'off'}`}>{t(active ? 'active' : 'inactive')}</span></td>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(w.lastActive, lang)}</td>
                  <td><Link className="btn sm" to={`/portal/workers/${w.id}`}>{t('view_profile')}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
