// Plantation Stock Supabase project. The anon key is public by design;
// what each caller may read or change is enforced by the database and
// the Edge Functions, not by this file.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://pxzvayptwpvuvlenmdwp.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'sb_publishable_tKap42sXnzGzmVUoLAw4xQ__bkXq8l_';

export const SUPER_ADMIN_EMAIL = 'hqadmin.puigroups@gmail.com';

// Same key the (legacy) Stock module reads, so a signed-in worker opens Stock directly.
export const WORKER_SESSION_KEY = 'opp_auth_session';
export const LANG_KEY = 'opp_lang';

// MJM Intranet: the Worker Portal icon there signs people in to Mantap.
export const INTRANET_URL = 'https://mjmelon.github.io/MJM-Intranet/';
