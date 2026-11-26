import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LangToggle } from '../../components/LangToggle';
import { getWorker, portalMe, portCompany, refreshWorker, setPortCompany, signOutAdmin, signOutWorker, updateWorker, type PortalMe } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { MODULES } from '../../lib/modules';

/** MANTAP mobile home: the module buttons. The ☰ menu has two dropdowns to pick
 *  the company and the location; the profile circle shows the worker profile and sign out. */
export function MobileHomePage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(getWorker);
  const [me, setMe] = useState<PortalMe | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState(false);
  const [profile, setProfile] = useState(false);

  // Pick up access / estate / status changes made by the admin.
  useEffect(() => {
    if (getWorker()?.preview) { portalMe().then(setMe); return; } // Intranet person's preview: companies from the portal
    refreshWorker().then((w) => (w ? setWorker(w) : navigate('/m?inactive=1', { replace: true })));
  }, [navigate]);

  if (!worker) return <Navigate to="/m" replace />;

  const modules = MODULES.filter((m) => m.allowed(worker));
  const company = portCompany();
  const companies = me?.companies ?? [];
  const locations = worker.preview ? (company && me?.locations ? me.locations[company.id] ?? [] : []) : worker.estates;
  const location = worker.estate && locations.includes(worker.estate) ? worker.estate : locations[0] || '';

  function pickCompany(id: string) {
    const c = companies.find((x) => x.id === id); if (!c) return;
    setPortCompany(c);
    const locs = me?.locations?.[c.id] ?? [];
    const w = updateWorker({ estates: locs.length ? locs : [c.name], estate: locs[0] || '' });
    if (w) setWorker(w);
  }
  function pickLocation(name: string) {
    const w = updateWorker({ estate: name });
    if (w) setWorker(w);
  }
  async function signOut() {
    if (!confirm(t('sign_out_q'))) return;
    await signOutWorker();
    if (worker?.preview) await signOutAdmin();
    navigate('/m', { replace: true });
  }
  const initial = (worker.name || '?').trim().slice(0, 1).toUpperCase();

  return (
    <div className="worker-page" onClick={() => { if (menu) setMenu(false); }}>
      <header className="worker-bar worker-bar-3">
        <button className="bar-btn" type="button" aria-label={t('menu')} onClick={() => setDrawer(true)}>☰</button>
        <div className="brand-title">MANTAP</div>
        <div className="bar-right">
          <LangToggle />
          <div className="profile-wrap">
            <button className="profile" type="button" title={worker.name} aria-label={worker.name} onClick={(e) => { e.stopPropagation(); setMenu((v) => !v); }}>{initial}</button>
            {menu && (
              <div className="menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => { setMenu(false); setProfile(true); }}>👷 {t('worker_profile')}</button>
                <button type="button" onClick={() => { setMenu(false); signOut(); }}>⎋ {t('sign_out')}</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="worker-wrap">
        <p className="hello">{t('welcome')}</p>
        <h1 className="name" id="who">{worker.name}</h1>
        <div className="mod-grid">
          {modules.length === 0 && <div className="empty">{t('no_modules')}</div>}
          {modules.map((m) => (
            <a key={m.id} className="mod" href={m.href}>
              <span className="mod-icon" style={{ background: `${m.color}1f` }}>{m.icon}</span>
              <span className="mod-name">{m.name[lang]}</span>
            </a>
          ))}
        </div>
      </main>

      {/* ☰ drawer: company, then location */}
      <div className={`drawer-bg${drawer ? ' open' : ''}`} onClick={() => setDrawer(false)} />
      <aside className={`drawer${drawer ? ' open' : ''}`} aria-hidden={!drawer}>
        <div className="drawer-head"><b>MANTAP</b><button className="bar-btn dark" type="button" aria-label={t('close')} onClick={() => setDrawer(false)}>✕</button></div>
        {companies.length > 0 && (
          <label className="drawer-sec drawer-pick">
            <span className="drawer-label">{t('company')}</span>
            <select value={company?.id ?? ''} onChange={(e) => pickCompany(e.target.value)}>
              {!company && <option value="">—</option>}
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {locations.length > 0 && (
          <label className="drawer-sec drawer-pick">
            <span className="drawer-label">{t('location')}</span>
            <select value={location} onChange={(e) => pickLocation(e.target.value)}>
              {locations.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}
        {companies.length === 0 && locations.length === 0 && <p className="muted" style={{ padding: 16 }}>—</p>}
      </aside>

      {/* Worker profile sheet */}
      {profile && (
        <div className="sheet-bg" onClick={() => setProfile(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-avatar">{initial}</div>
            <h2 style={{ margin: '8px 0 2px' }}>{worker.name}</h2>
            <p className="muted small" style={{ margin: 0 }}>{worker.email.replace(/@psms\.app$/, '')}</p>
            <dl className="sheet-grid">
              {company && <><dt>{t('company')}</dt><dd>{company.name}</dd></>}
              {location && <><dt>{t('location')}</dt><dd>{location}</dd></>}
            </dl>
            <button className="btn" type="button" onClick={() => setProfile(false)}>{t('close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
