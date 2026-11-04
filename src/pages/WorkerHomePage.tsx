import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { LangToggle } from '../components/LangToggle';
import { getWorker, refreshWorker, signOutWorker } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { MODULES } from '../lib/modules';

export function WorkerHomePage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(getWorker);

  // Pick up access / estate / status changes made by the admin.
  useEffect(() => {
    refreshWorker().then((w) => (w ? setWorker(w) : navigate('/?inactive=1', { replace: true })));
  }, [navigate]);

  if (!worker) return <Navigate to="/" replace />;

  const modules = MODULES.filter((m) => m.allowed(worker));

  async function signOut() {
    if (!confirm(t('sign_out_q'))) return;
    await signOutWorker();
    navigate('/', { replace: true });
  }

  return (
    <div className="worker-page">
      <header className="worker-bar">
        <Brand />
        <LangToggle />
      </header>
      <main className="worker-wrap">
        <p className="hello">{t('welcome')}</p>
        <h1 className="name" id="who">{worker.name}</h1>
        <p className="est">{worker.estates.length ? `🌴 ${worker.estates.join(', ')}` : ''}</p>
        <p className="sect">{t('modules')}</p>
        <div className="mod-grid">
          {modules.length === 0 && <div className="empty">{t('no_modules')}</div>}
          {modules.map((m) => (
            <a key={m.id} className="mod" href={m.href}>
              <span className="mod-icon" style={{ background: `${m.color}1f` }}>{m.icon}</span>
              <span className="mod-name">{m.name[lang]}</span>
              <span className="mod-desc">{m.desc[lang]}</span>
            </a>
          ))}
        </div>
        <button className="btn worker-out" type="button" onClick={signOut}>{t('sign_out')}</button>
      </main>
    </div>
  );
}
