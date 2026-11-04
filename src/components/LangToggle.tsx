import { useI18n, type Lang } from '../lib/i18n';

export function LangToggle() {
  const { lang, setLang } = useI18n();
  const opts: [Lang, string][] = [['en', 'EN'], ['ms', 'BM']];
  return (
    <div className="lang">
      {opts.map(([l, label]) => (
        <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{label}</button>
      ))}
    </div>
  );
}
