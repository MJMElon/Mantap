-- Mantap: failed worker sign-in counter (5 wrong passwords → 15-minute lock).
-- Only the mantap-worker-auth Edge Function (service role) reads or writes it.
create table if not exists public.mantap_login_attempts (
  email        text primary key,
  fails        integer     not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.mantap_login_attempts enable row level security;
-- No policies: anon and authenticated users have no access.
revoke all on public.mantap_login_attempts from anon, authenticated;
