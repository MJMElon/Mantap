import { useEffect, useRef, useState } from 'react';
import { useErrorText, useI18n } from '../../lib/i18n';
import { STOCK_SECTIONS, stockAccess } from '../../lib/modules';
import type { Access, Worker } from '../../lib/types';
import { createWorker, updateWorker } from '../../lib/workers';
import { toUserId } from './WorkersPage';

interface Props {
  worker: Worker | null; // null = new worker
  estates: string[];
  onClose: () => void;
  onSaved: () => void;
}

const LEVELS: Access[] = ['none', 'view', 'edit'];

export function WorkerDialog({ worker, estates, onClose, onSaved }: Props) {
  const { t, lang } = useI18n();
  const errorText = useErrorText();
  const ref = useRef<HTMLDialogElement>(null);
  const isNew = worker === null;

  const [name, setName] = useState(worker?.name ?? '');
  const [userId, setUserId] = useState(worker ? toUserId(worker.email) : '');
  const [password, setPassword] = useState('');
  const [picked, setPicked] = useState<string[]>(worker?.estates ?? []);
  const [access, setAccess] = useState<Record<string, Access>>(() =>
    Object.fromEntries(STOCK_SECTIONS.map((s) => [s.id, stockAccess(worker?.permissions, s.id)])));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { ref.current?.showModal(); }, []);

  const toggleEstate = (n: string) =>
    setPicked((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]));

  async function save() {
    setError('');
    if (!name.trim() || (isNew && !userId.trim())) { setError(t('need_name_id')); return; }
    if (isNew && password.length < 6) { setError(t('pw_short')); return; }
    if (!picked.length) { setError(t('need_estate')); return; }
    setBusy(true);
    try {
      if (isNew) await createWorker({ userId: userId.trim().toLowerCase(), name: name.trim(), password, estates: picked, access });
      else await updateWorker(worker.id, { name: name.trim(), estates: picked, access });
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <div className="dlg-h">{isNew ? t('add_worker') : `${t('edit')} · ${worker.name}`}</div>
      <div className="dlg-b">
        <div className="row">
          <label className="label" htmlFor="fName">{t('full_name')}</label>
          <input className="input" id="fName" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="row">
          <label className="label" htmlFor="fId">{t('col_id')}</label>
          <input className="input" id="fId" value={userId} disabled={!isNew}
            onChange={(e) => setUserId(e.target.value)} autoCapitalize="none" spellCheck={false} />
        </div>
        {isNew && (
          <div className="row">
            <label className="label" htmlFor="fPw">{t('new_password')}</label>
            <input className="input" id="fPw" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
        )}
        <div className="row">
          <span className="label">{t('estates')}</span>
          <div className="checks">
            {estates.map((n) => (
              <label key={n}>
                <input type="checkbox" className="est-cb" value={n} checked={picked.includes(n)} onChange={() => toggleEstate(n)} /> {n}
              </label>
            ))}
          </div>
        </div>
        <div className="row">
          <span className="label">{t('module_access')}</span>
          <div className="acc">
            <div className="acc-h">📦 {lang === 'ms' ? 'Stok' : 'Stock'}</div>
            {STOCK_SECTIONS.map((s) => (
              <div key={s.id} className="acc-r">
                <span>{s.icon} {s.label[lang]}</span>
                {LEVELS.map((v) => (
                  <label key={v}>
                    <input type="radio" name={`acc_${s.id}`} value={v} checked={access[s.id] === v}
                      onChange={() => setAccess((a) => ({ ...a, [s.id]: v }))} />
                    {' '}{t(v === 'edit' ? 'edit_access' : v)}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="err">{error}</p>
      </div>
      <div className="dlg-f">
        <button className="btn" type="button" onClick={() => ref.current?.close()}>{t('cancel')}</button>
        <button className="btn primary" type="button" id="dlgSave" onClick={save} disabled={busy}>{busy ? t('saving') : t('save')}</button>
      </div>
    </dialog>
  );
}
