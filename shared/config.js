/* Mantap Worker Portal — settings.
   Uses the Plantation Stock database (Supabase project eukvdlyzhyjohkjqbqjb),
   so workers keep the same accounts and stock data.
   The anon key is public; access is controlled by the database. */
window.MANTAP_CONFIG = {
  SUPABASE_URL: 'https://eukvdlyzhyjohkjqbqjb.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1a3ZkbHl6aHlqb2hranFicWpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2OTg5MzYsImV4cCI6MjA5NDI3NDkzNn0.czKzWGeiujgZ_VpOBZjFaxDjGCca-_-aZ41N5T0gjmk',
  SUPER_ADMIN_EMAIL: 'hqadmin.puigroups@gmail.com',
  USERS_TABLE: 'opp_users',
  // Same key the Stock module uses, so a worker signed in here opens Stock directly.
  WORKER_SESSION_KEY: 'opp_auth_session',
  // Admin session is kept separately so the Mobile Demo can sign in a worker
  // without signing the admin out.
  ADMIN_SESSION_KEY: 'mantap_admin_session',
  LANG_KEY: 'opp_lang',
};
