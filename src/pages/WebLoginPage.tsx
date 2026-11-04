import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { LangToggle } from '../components/LangToggle';
import { signIn, signOutWorker } from '../lib/auth';
import { INTRANET_URL } from '../lib/config';
import { useErrorText, useI18n } from '../lib/i18n';

/** Web portal sign-in: normally people arrive from MJM Intranet (no password).
 *  The Stock Super Admin can still sign in with email + password here. */
export function WebLoginPage() {
  const { t } = useI18n();
  const errorText = useErrorText();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const kind = await signIn(email, password);
      if (kind !== 'admin') { await signOutWorker(); setError(t('err_forbidden')); return; }
      navigate('/portal', { replace: true });
    } catch (ex) {
      setError(errorText(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <main className="login-card">
        <div className="login-top"><Brand /><LangToggle /></div>
        <h1>{t('web_login_title')}</h1>
        <p className="sub">{t('web_login_sub')}</p>
        <a className="btn primary" style={{ width: '100%', padding: 13 }} href={INTRANET_URL}>{t('open_intranet')}</a>
        {!showForm ? (
          <button type="button" className="btn" style={{ width: '100%', marginTop: 12, border: 0 }} onClick={() => setShowForm(true)}>
            {t('super_admin_login')}
          </button>
        ) : (
          <form onSubmit={submit} style={{ marginTop: 20 }}>
            <div className="field">
              <label className="label" htmlFor="aemail">{t('admin_email')}</label>
              <input className="input" id="aemail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="field">
              <label className="label" htmlFor="apw">{t('password')}</label>
              <input className="input" id="apw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <button className="btn primary" id="adminLoginBtn" type="submit" disabled={busy}>{busy ? t('signing_in') : t('sign_in')}</button>
          </form>
        )}
        <p className="err">{error}</p>
      </main>
    </div>
  );
}
