import { useState } from 'react';
import { useI18n } from '../../lib/i18n';

// The worker app as the signed-in person sees it (their companies and locations, no worker login)
const DEMO_URL = `${import.meta.env.BASE_URL}#/m`;

export function MobileViewPage() {
  const { t } = useI18n();
  const [key, setKey] = useState(0);
  return (
    <div className="demo">
      <div>
        <h2>{t('demo_title')}</h2>
        <p className="muted">{t('demo_sub')}</p>
        <div className="acts" style={{ marginTop: 16 }}>
          <button className="btn" type="button" onClick={() => setKey((k) => k + 1)}>{t('reload')}</button>
          <a className="btn" href={DEMO_URL} target="_blank" rel="noopener">{t('open_tab')}</a>
        </div>
      </div>
      <div className="phone">
        <iframe key={key} src={DEMO_URL} title="Mobile demo" />
      </div>
    </div>
  );
}
