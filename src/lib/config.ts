// Plantation Stock Supabase project. The anon key is public by design;
// what each caller may read or change is enforced by the database and
// the Edge Functions, not by this file.
export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://eukvdlyzhyjohkjqbqjb.supabase.co';
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a3ZkbHl6aHlqb2hranFicWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTg5MzYsImV4cCI6MjA5NDI3NDkzNn0.czKzWGeiujgZ_VpOBZjFaxDjGCca-_-aZ41N5T0gjmk';

export const SUPER_ADMIN_EMAIL = 'hqadmin.puigroups@gmail.com';

// Same key the (legacy) Stock module reads, so a signed-in worker opens Stock directly.
export const WORKER_SESSION_KEY = 'opp_auth_session';
export const LANG_KEY = 'opp_lang';
