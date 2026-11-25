import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { takePortSession } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import './styles.css';

// A session handed over from Plantation Operation is stored before the first route renders
takePortSession().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
});
