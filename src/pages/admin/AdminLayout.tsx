import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { LangToggle } from '../../components/LangToggle';
import { isAdminSignedIn, signOutAdmin } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';

export function AdminLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    isAdminSignedIn().then((ok) => (ok ? setReady(true) : navigate('/', { replace: true })));
  }, [navigate]);

  async function signOut() {
    if (!confirm(t('sign_out_q'))) return;
    await signOutAdmin();
    navigate('/', { replace: true });
  }

  if (!ready) return null;
  return (
    <>
      <header className="admin-head">
        <Brand sub="admin_title" />
        <div className="right">
          <LangToggle />
          <button className="btn sm" type="button" onClick={signOut}>{t('sign_out')}</button>
        </div>
      </header>
      <nav className="tabs">
        <NavLink end to="/admin" className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>{t('tab_workers')}</NavLink>
        <NavLink to="/admin/demo" className={({ isActive }) => `tab${isActive ? ' on' : ''}`}>{t('tab_demo')}</NavLink>
      </nav>
      <main className="admin-main">
        <Outlet />
      </main>
    </>
  );
}
