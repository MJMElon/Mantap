-- Mantap: MJM Intranet users who may use the Worker Portal.
--   web_access    → Worker Portal web (Worker Manage, User Access, Mobile View)
--   mobile_access → Worker Portal mobile (signs in from MJM Intranet; uses a
--                   linked opp_users row with role estate_user for Stock)
-- Only the Mantap Edge Functions (service role) read or write it.
create table if not exists public.mantap_portal_users (
  email            text primary key check (email = lower(email)),
  name             text not null default '',
  intranet_user_id uuid,
  web_access       boolean not null default false,
  mobile_access    boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.mantap_portal_users enable row level security;
revoke all on public.mantap_portal_users from anon, authenticated;
