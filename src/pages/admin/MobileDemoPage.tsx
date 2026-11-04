import { useState } from 'react';
import { useI18n } from '../../lib/i18n';

const DEMO_URL = `${import.meta.env.BASE_URL}#/?demo=1`;

export function MobileDemoPage() {
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
