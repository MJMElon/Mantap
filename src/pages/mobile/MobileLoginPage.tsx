import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../../components/Brand';
import { LangToggle } from '../../components/LangToggle';
import { getWorker, signIn, signOutAdmin } from '../../lib/auth';
import { useErrorText, useI18n } from '../../lib/i18n';

/** Mobile sign-in (workers with User ID + password). Also shown inside the web portal's Mobile View. */
export function MobileLoginPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The admin's Mobile Demo shows the worker side even when an admin is signed in.
  const isDemo = params.has('demo') || window.self !== window.top;

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.has('inactive') ? t('err_inactive') : '');

  useEffect(() => {
    if (getWorker()) { navigate('/m/home', { replace: true }); return; }
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const kind = await signIn(userId, password);
      if (kind === 'admin' && isDemo) {
        await signOutAdmin();
        setError(t('err_not_worker'));
        return;
      }
      navigate(kind === 'admin' ? '/portal' : '/m/home', { replace: true });
    } catch (ex) {
      setError(errorText(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <main className="login-card">
        <div className="login-top">
          <Brand />
          <LangToggle />
        </div>
        <h1>{t('login_title')}</h1>
        <p className="sub">{t('login_sub')}</p>
        <form onSubmit={submit} autoComplete="on">
          <div className="field">
            <label className="label" htmlFor="uid">{t('user_id')}</label>
            <input className="input" id="uid" value={userId} onChange={(e) => setUserId(e.target.value)}
              autoComplete="username" autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="field">
            <label className="label" htmlFor="pw">{t('password')}</label>
            <input className="input" id="pw" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <button className="btn primary" id="loginBtn" type="submit" disabled={busy}>
            {busy ? t('signing_in') : t('sign_in')}
          </button>
          <p className="err" id="loginErr">{error}</p>
        </form>
      </main>
    </div>
  );
}
