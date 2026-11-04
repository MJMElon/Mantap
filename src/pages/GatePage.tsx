import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWorker, isAdminSignedIn, signInFromIntranet, takeIntranetToken } from '../lib/auth';
import { useErrorText, useI18n } from '../lib/i18n';

const isPhone = () => window.matchMedia('(max-width: 767px)').matches;

/** Entry point. From MJM Intranet (?gw_token=…) → web portal (or mobile home on a phone);
 *  otherwise the existing session decides, else the web sign-in page. */
export function GatePage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = takeIntranetToken();
    (async () => {
      if (token) {
        try {
          const p = await signInFromIntranet(token);
          const toMobile = p.mobile && (!p.web || isPhone());
          navigate(toMobile ? '/m/home' : '/portal', { replace: true });
        } catch (e) {
          setError(errorText(e));
        }
        return;
      }
      if (await isAdminSignedIn()) navigate('/portal', { replace: true });
      else if (getWorker() && isPhone()) navigate('/m/home', { replace: true });
      else navigate('/login', { replace: true });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="login-page">
      <main className="login-card">
        {error ? <p className="err">{error}</p> : <p className="muted">{t('signing_in_intranet')}</p>}
        {error && <a className="btn" href="./#/login">{t('back')}</a>}
      </main>
    </div>
  );
}
