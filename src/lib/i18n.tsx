import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { LANG_KEY } from './config';

const en = {
  portal: 'Worker Portal',
  login_title: 'Sign in',
  login_sub: 'Use your User ID and password.',
  user_id: 'User ID',
  password: 'Password',
  sign_in: 'Sign In',
  signing_in: 'Signing in…',
  sign_out: 'Sign out',
  sign_out_q: 'Sign out?',
  err_empty_id: 'Please enter your User ID.',
  err_empty_pw: 'Please enter your password.',
  err_wrong: 'Incorrect User ID or password.',
  err_locked: 'Too many attempts. Please wait 15 minutes and try again.',
  err_inactive: 'Your account has been deactivated. Please contact your administrator.',
  err_not_worker: 'This portal is for estate workers. HQ users please use the Stock system.',
  err_network: 'Could not connect. Please check your connection and try again.',
  err_forbidden: 'You do not have permission to do this.',
  err_exists: 'This User ID already exists.',
  err_reserved: 'That User ID is reserved.',
  err_invalid: 'Please check the details and try again.',
  welcome: 'Welcome',
  modules: 'Modules',
  no_modules: 'No modules are open for you yet. Please contact your administrator.',
  estates: 'Estates',
  admin_title: 'Worker Portal Admin',
  tab_workers: 'Workers',
  tab_demo: 'Mobile Demo',
  add_worker: 'Add Worker',
  search: 'Search name or User ID',
  all_estates: 'All estates',
  col_name: 'Name',
  col_id: 'User ID',
  col_estates: 'Estates',
  col_access: 'Stock access',
  col_status: 'Status',
  col_last: 'Last active',
  active: 'Active',
  inactive: 'Inactive',
  edit: 'Edit',
  reset_pw: 'Reset password',
  activate: 'Activate',
  deactivate: 'Deactivate',
  delete: 'Delete',
  full_name: 'Full name',
  new_password: 'New password (min. 6 characters)',
  module_access: 'Module access',
  none: 'None',
  view: 'View',
  edit_access: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  saving: 'Saving…',
  need_estate: 'Please select at least one estate.',
  need_name_id: 'Please fill in Full name and User ID.',
  pw_short: 'Password must be at least 6 characters.',
  confirm_delete: 'Delete this worker? This cannot be undone.',
  saved: 'Saved.',
  loading: 'Loading…',
  no_workers: 'No workers found.',
  demo_title: 'Mobile view demo',
  demo_sub: 'This is what workers see on their phone. Sign in with a worker account to try it. Your admin session is not affected.',
  reload: 'Reload',
  open_tab: 'Open in new tab',
  workers_count: 'workers',
};
type Dict = typeof en;

const ms: Dict = {
  portal: 'Portal Pekerja',
  login_title: 'Log masuk',
  login_sub: 'Gunakan ID Pengguna dan kata laluan anda.',
  user_id: 'ID Pengguna',
  password: 'Kata laluan',
  sign_in: 'Log Masuk',
  signing_in: 'Sedang log masuk…',
  sign_out: 'Log keluar',
  sign_out_q: 'Log keluar?',
  err_empty_id: 'Sila masukkan ID Pengguna anda.',
  err_empty_pw: 'Sila masukkan kata laluan anda.',
  err_wrong: 'ID Pengguna atau kata laluan salah.',
  err_locked: 'Terlalu banyak cubaan. Sila tunggu 15 minit dan cuba lagi.',
  err_inactive: 'Akaun anda telah dinyahaktifkan. Sila hubungi pentadbir anda.',
  err_not_worker: 'Portal ini untuk pekerja ladang. Pengguna HQ sila gunakan sistem Stok.',
  err_network: 'Tidak dapat disambungkan. Sila semak sambungan anda dan cuba lagi.',
  err_forbidden: 'Anda tiada kebenaran untuk melakukan ini.',
  err_exists: 'ID Pengguna ini sudah wujud.',
  err_reserved: 'ID Pengguna itu dikhaskan.',
  err_invalid: 'Sila semak butiran dan cuba lagi.',
  welcome: 'Selamat datang',
  modules: 'Modul',
  no_modules: 'Tiada modul dibuka untuk anda lagi. Sila hubungi pentadbir anda.',
  estates: 'Ladang',
  admin_title: 'Pentadbir Portal Pekerja',
  tab_workers: 'Pekerja',
  tab_demo: 'Demo Mudah Alih',
  add_worker: 'Tambah Pekerja',
  search: 'Cari nama atau ID Pengguna',
  all_estates: 'Semua ladang',
  col_name: 'Nama',
  col_id: 'ID Pengguna',
  col_estates: 'Ladang',
  col_access: 'Akses stok',
  col_status: 'Status',
  col_last: 'Aktif terakhir',
  active: 'Aktif',
  inactive: 'Tidak aktif',
  edit: 'Ubah',
  reset_pw: 'Set semula kata laluan',
  activate: 'Aktifkan',
  deactivate: 'Nyahaktifkan',
  delete: 'Padam',
  full_name: 'Nama penuh',
  new_password: 'Kata laluan baharu (min. 6 aksara)',
  module_access: 'Akses modul',
  none: 'Tiada',
  view: 'Lihat',
  edit_access: 'Ubah',
  save: 'Simpan',
  cancel: 'Batal',
  saving: 'Menyimpan…',
  need_estate: 'Sila pilih sekurang-kurangnya satu ladang.',
  need_name_id: 'Sila isi Nama penuh dan ID Pengguna.',
  pw_short: 'Kata laluan mesti sekurang-kurangnya 6 aksara.',
  confirm_delete: 'Padam pekerja ini? Tindakan ini tidak boleh dibatalkan.',
  saved: 'Disimpan.',
  loading: 'Memuatkan…',
  no_workers: 'Tiada pekerja dijumpai.',
  demo_title: 'Demo paparan mudah alih',
  demo_sub: 'Ini paparan yang pekerja lihat di telefon. Log masuk dengan akaun pekerja untuk mencuba. Sesi pentadbir anda tidak terjejas.',
  reload: 'Muat semula',
  open_tab: 'Buka di tab baharu',
  workers_count: 'pekerja',
};

export type Lang = 'en' | 'ms';
export type TextKey = keyof Dict;
const DICTS: Record<Lang, Dict> = { en, ms };

export function isTextKey(k: string): k is TextKey {
  return k in en;
}

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TextKey) => string;
}
const I18nContext = createContext<I18nValue | null>(null);

function readLang(): Lang {
  try { return localStorage.getItem(LANG_KEY) === 'ms' ? 'ms' : 'en'; } catch { return 'en'; }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang);
  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(LANG_KEY, l); } catch { /* private mode */ }
    setLangState(l);
  }, []);
  const t = useCallback((k: TextKey) => DICTS[lang][k], [lang]);
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

/** Translate an error code thrown by the API layer. */
export function useErrorText() {
  const { t } = useI18n();
  return (e: unknown) => {
    const code = e instanceof Error ? e.message : '';
    return t(isTextKey(code) ? code : 'err_network');
  };
}
