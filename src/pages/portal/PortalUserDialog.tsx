import { useEffect, useRef, useState } from 'react';
import { useErrorText, useI18n } from '../../lib/i18n';
import { STOCK_SECTIONS, stockAccess } from '../../lib/modules';
import type { Access } from '../../lib/types';
import { savePortalUser, type PortalUser } from '../../lib/workers';

interface Props {
  user: PortalUser | null; // null = add
  estates: string[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const LEVELS: Access[] = ['none', 'view', 'edit'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Add / edit an MJM Intranet user's Worker Portal access (web, mobile; for mobile also estates + Stock access). */
export function PortalUserDialog({ user, estates, isSelf, onClose, onSaved }: Props) {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const ref = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState(user?.email ?? '');
  const [name, setName] = useState(user?.name ?? '');
  const [web, setWeb] = useState(user?.web_access ?? true);
  const [mobile, setMobile] = useState(user?.mobile_access ?? false);
  const [picked, setPicked] = useState<string[]>(user?.estates ?? []);
  const [access, setAccess] = useState<Record<string, Access>>(() =>
    Object.fromEntries(STOCK_SECTIONS.map((s) => [s.id, stockAccess(user?.permissions, s.id)])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { ref.current?.showModal(); }, []);

  async function save() {
    setError('');
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { setError(t('need_email')); return; }
    if (!web && !mobile) { setError(t('need_web_or_mobile')); return; }
    if (mobile && !picked.length) { setError(t('need_estate')); return; }
    setBusy(true);
    try {
      await savePortalUser({ email: e, name: name.trim(), web, mobile, estates: picked, access });
      onSaved();
    } catch (ex) {
      setError(errorText(ex));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <div className="dlg-h">{user ? `${t('edit')} · ${user.name || user.email}` : t('add_user')}</div>
      <div className="dlg-b">
        <div className="row">
          <label className="label" htmlFor="pEmail">{t('email')}</label>
          <input className="input" id="pEmail" value={email} disabled={!!user} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" spellCheck={false} />
        </div>
        <div className="row">
          <label className="label" htmlFor="pName">{t('full_name')}</label>
          <input className="input" id="pName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="row checks">
          <label><input type="checkbox" id="pWeb" checked={web} disabled={isSelf} onChange={(e) => setWeb(e.target.checked)} /> {t('web')}</label>
          <label><input type="checkbox" id="pMobile" checked={mobile} onChange={(e) => setMobile(e.target.checked)} /> {t('mobile')}</label>
        </div>
        {mobile && (
          <div className="row">
            <span className="label">{t('mobile_setup')}</span>
            <div className="checks" style={{ marginBottom: 10 }}>
              {estates.map((n) => (
                <label key={n}>
                  <input type="checkbox" className="est-cb" value={n} checked={picked.includes(n)}
                    onChange={() => setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))} /> {n}
                </label>
              ))}
            </div>
            <div className="acc">
              <div className="acc-h">📦 {lang === 'ms' ? 'Stok' : 'Stock'}</div>
              {STOCK_SECTIONS.map((s) => (
                <div key={s.id} className="acc-r">
                  <span>{s.icon} {s.label[lang]}</span>
                  {LEVELS.map((v) => (
                    <label key={v}>
                      <input type="radio" name={`pacc_${s.id}`} checked={access[s.id] === v} onChange={() => setAccess((a) => ({ ...a, [s.id]: v }))} />
                      {' '}{t(v === 'edit' ? 'edit_access' : v)}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="err">{error}</p>
      </div>
      <div className="dlg-f">
        <button className="btn" type="button" onClick={() => ref.current?.close()}>{t('cancel')}</button>
        <button className="btn primary" type="button" id="pSave" onClick={save} disabled={busy}>{busy ? t('saving') : t('save')}</button>
      </div>
    </dialog>
  );
}
