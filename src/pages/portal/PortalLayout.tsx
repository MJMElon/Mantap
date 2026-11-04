import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { LangToggle } from '../../components/LangToggle';
import { portalMe, signOutAdmin, type PortalMe } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';

/** Web portal frame: header, back link on sub-pages, and the sign-in check. */
export function PortalLayout() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [me, setMe] = useState<PortalMe | null>(null);

  useEffect(() => {
    portalMe().then((m) => (m ? setMe(m) : navigate('/login', { replace: true })));
  }, [navigate]);

  async function signOut() {
    if (!confirm(t('sign_out_q'))) return;
    await signOutAdmin();
    navigate('/login', { replace: true });
  }

  if (!me) return null;
  return (
    <>
      <header className="admin-head">
        <Link to="/portal" style={{ textDecoration: 'none', color: 'inherit' }}><Brand sub="admin_title" /></Link>
        <div className="right">
          <span className="muted" style={{ fontSize: 13 }}>{me.name}</span>
          <LangToggle />
          <button className="btn sm" type="button" onClick={signOut}>{t('sign_out')}</button>
        </div>
      </header>
      <main className="admin-main">
        {pathname !== '/portal' && (
          <Link to="/portal" className="btn sm" style={{ marginBottom: 16 }}>← {t('portal_home')}</Link>
        )}
        <Outlet context={me} />
      </main>
    </>
  );
}
