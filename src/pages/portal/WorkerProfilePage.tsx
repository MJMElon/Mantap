import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useErrorText, useI18n } from '../../lib/i18n';
import { STOCK_SECTIONS, stockAccess } from '../../lib/modules';
import type { Worker } from '../../lib/types';
import { listWorkers } from '../../lib/workers';
import { fmtDateTime, toUserId } from './WorkersPage';

/** Worker profile: read only. Changes are made in User Setting. */
export function WorkerProfilePage() {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const { id } = useParams();
  const [worker, setWorker] = useState<Worker | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    listWorkers()
      .then((r) => setWorker(r.workers.find((w) => String(w.id) === String(id)) ?? null))
      .catch((e) => setError(errorText(e)));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="err">{error}</p>;
  if (worker === undefined) return <p className="muted">{t('loading')}</p>;
  if (worker === null) return <p className="muted">{t('worker_not_found')}</p>;

  const active = worker.status !== 'inactive';
  const initials = worker.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <section className="profile">
      <div className="profile-head">
        <span className="profile-avatar">{initials || '👷'}</span>
        <div style={{ minWidth: 0 }}>
          <h2 className="h2" style={{ margin: 0 }}>{worker.name}</h2>
          <p className="muted small" style={{ margin: '2px 0 0' }}>
            <span className="pill role-worker">{t('role_worker')}</span>
            {worker.intranet && <> <span className="pill view">{t('intranet_badge')}</span></>}
            {' '}<span className={`pill ${active ? 'on' : 'off'}`}>{t(active ? 'active' : 'inactive')}</span>
          </p>
        </div>
        <Link className="btn sm" to="/portal/workers" style={{ marginLeft: 'auto' }}>← {t('back_to_workers')}</Link>
      </div>

      <dl className="profile-grid">
        <dt>{t('col_id')}</dt><dd>{toUserId(worker.email)}</dd>
        <dt>{t('col_role')}</dt><dd>{t('role_worker')}</dd>
        <dt>{t('col_status')}</dt><dd>{t(active ? 'active' : 'inactive')}</dd>
        <dt>{t('col_last')}</dt><dd>{fmtDateTime(worker.lastActive, lang)}</dd>
        <dt>{t('col_estates')}</dt>
        <dd>{worker.estates.length ? worker.estates.map((n) => <span key={n} className="pill est">{n}</span>) : <span className="muted">—</span>}</dd>
        <dt>{t('col_access')}</dt>
        <dd>
          {STOCK_SECTIONS.map((s) => {
            const a = stockAccess(worker.permissions, s.id);
            return (
              <span key={s.id} className={`pill ${a === 'none' ? 'off' : a}`}>
                {s.icon} {s.label[lang]} · {t(a === 'edit' ? 'edit_access' : a === 'view' ? 'view' : 'none')}
              </span>
            );
          })}
        </dd>
      </dl>
      <p className="muted small">{t('profile_readonly')} <Link to="/portal/users">{t('tile_users')}</Link>.</p>
    </section>
  );
}
