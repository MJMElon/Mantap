# Mantap · Worker Portal

The portal for estate workers. On the web, admins manage the worker list and
worker access and can preview the mobile view. On a phone, workers sign in and
open their work modules. The only module today is **Stock**; more will be
added later.

- **Frontend:** React 18 + TypeScript + Vite, with React Router (hash routes).
  The published site is the minified build in `dist/`.
- **Backend:** the **Plantation Stock** Supabase project (`eukvdlyzhyjohkjqbqjb`):
  - database tables `opp_*`
  - Supabase Auth
  - the Edge Functions in `supabase/functions/`
- **Hosting:** GitHub Pages, built by `.github/workflows/pages.yml` on every
  push to `main`.
- **Interface text:** English and Bahasa Melayu (`src/lib/i18n.tsx`).

## Project layout

```
src/
  main.tsx, App.tsx          entry point and routes (#/, #/app, #/admin, #/admin/demo)
  styles.css                 all styles
  lib/
    config.ts                Supabase URL / anon key, storage keys
    supabase.ts              Supabase clients (worker and admin) + Edge Function caller
    auth.ts                  sign-in, sign-out, worker session refresh
    workers.ts               admin worker API (calls mantap-worker-admin)
    modules.ts               modules on the worker home; Stock access items
    i18n.tsx                 EN / BM text and language switch
    types.ts                 shared types
  components/                Brand, LangToggle
  pages/
    LoginPage.tsx            sign-in for workers and the Super Admin
    WorkerHomePage.tsx       worker home (phone): greeting, estates, module cards
    admin/
      AdminLayout.tsx        admin header, tabs, Super Admin check
      WorkersPage.tsx        worker list: search, estate filter, actions
      WorkerDialog.tsx       add / edit worker (estates, Stock access)
      MobileDemoPage.tsx     phone-sized preview of the worker side
public/stock/                Stock module (legacy worker view of the Stock app;
                             replaced when the Stock app is rebuilt in React)
supabase/
  functions/mantap-worker-auth    worker sign-in (password checked on the server,
                                  5 wrong tries → 15-minute lock) and "me" refresh
  functions/mantap-worker-admin   worker list / create / update / reset password /
                                  status / delete (Super Admin only)
  migrations/                     mantap_login_attempts table
```

## Security model

- Worker passwords are checked **only in the `mantap-worker-auth` Edge
  Function**. The browser never receives password hashes. After a correct
  password, the function issues a normal Supabase Auth session for the
  worker (`<id>@psms.app`).
- All worker management goes through `mantap-worker-admin`, which checks that
  the caller is signed in as the Super Admin and validates every field.
- The admin session is stored separately (`mantap-admin-auth`), so the
  Mobile Demo can sign in a worker without signing the admin out.
- Still open until the Stock app is rebuilt: the old Stock app reads
  `opp_users` directly, so the anon key can still read that table. See
  `docs/security-next.md`.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173/Mantap/
npm run build        # type-check + production build into dist/
```

## Deploying the backend (once, and after changes)

```bash
npx supabase link --project-ref eukvdlyzhyjohkjqbqjb
npx supabase db push                          # creates mantap_login_attempts
npx supabase functions deploy mantap-worker-auth --no-verify-jwt
npx supabase functions deploy mantap-worker-admin
# optional overrides:
# npx supabase secrets set SUPER_ADMIN_EMAIL=... MANTAP_ALLOWED_ORIGINS=https://mjmelon.github.io
```

## Adding a module

1. Build its pages (a new route in `src/App.tsx`, or a folder under `public/`).
2. Add an entry to `MODULES` in `src/lib/modules.ts`.
3. If it needs per-worker access settings, add them to `WorkerDialog.tsx` and
   to the allowed keys in `supabase/functions/_shared/common.ts`.
