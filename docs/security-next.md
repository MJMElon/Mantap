# Security: remaining steps

Done in Mantap:
- Worker sign-in checks passwords on the server (`mantap-worker-auth`).
- Worker management runs on the server and is limited to the Super Admin
  (`mantap-worker-admin`).

Still open, because the old Stock app (HQ side) talks to the database
directly with the anon key:

1. **`opp_users.password_hash` can be read with the anon key.** Once the Stock
   app signs HQ users in through an Edge Function too, run:

   ```sql
   revoke select on public.opp_users from anon;
   -- signed-in users read only their own row (others via Edge Functions)
   alter table public.opp_users enable row level security;
   create policy opp_users_self on public.opp_users for select to authenticated
     using (email = auth.jwt() ->> 'email');
   ```

2. **`opp_*` stock tables** should only allow signed-in users, limited to
   their estates. This is planned for the Stock app rebuild.

3. **Check before going live:** workers now have a real Supabase Auth session
   (role `authenticated`, not `anon`). If any `opp_*` RLS policy allows only
   `anon`, the Stock module will not be able to read or write for workers.
   Make sure those policies also cover `authenticated` (or `public`).
