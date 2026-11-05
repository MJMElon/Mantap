-- Mantap: run this once in the STOCK Supabase project → SQL Editor → Run.
-- Safe to run again (it only adds what is missing).

-- Wrong-password lockout (5 tries → 15 minutes)
create table if not exists public.mantap_login_attempts (
  email text primary key,
  fails integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.mantap_login_attempts enable row level security;
revoke all on public.mantap_login_attempts from anon, authenticated;

-- Who may use the Worker Portal (web / mobile)
create table if not exists public.mantap_portal_users (
  email text primary key check (email = lower(email)),
  name text not null default '',
  intranet_user_id uuid,
  web_access boolean not null default false,
  mobile_access boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mantap_portal_users enable row level security;
revoke all on public.mantap_portal_users from anon, authenticated;

-- First Worker Portal web admin: change to your MJM Intranet email and name
insert into public.mantap_portal_users (email, name, web_access)
values ('coco.lau@puigroups.com', 'Coco Lau', true)
on conflict (email) do update set web_access = true;
