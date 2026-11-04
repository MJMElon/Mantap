import { useI18n, type TextKey } from '../lib/i18n';

export function Brand({ sub = 'portal' }: { sub?: TextKey }) {
  const { t } = useI18n();
  return (
    <div className="brand">
      <div className="brand-mark">M</div>
      <div>
        <div className="brand-name">Mantap</div>
        <div className="brand-sub">{t(sub)}</div>
      </div>
    </div>
  );
}
