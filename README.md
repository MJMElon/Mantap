# Mantap · Worker Portal

The portal for estate workers. On the web, admins manage the worker list and
worker access and can preview the mobile view. On a phone, workers sign in and
open their work modules. The only module today is **Stock**; more will be
added later.

- Plain HTML + JavaScript with no build step. Publish with GitHub Pages
  ("Deploy from a branch" → `main` / root).
- Database: the **Plantation Stock** Supabase project (`eukvdlyzhyjohkjqbqjb`),
  so workers keep the same accounts and stock data as before.
- Interface text: English and Bahasa Melayu (`shared/i18n.js`).

## Files

```
index.html          Sign-in (workers and the Super Admin)
app.html            Worker home (mobile): greeting, estates, module cards
admin.html          Web admin: Workers (list, add, edit estates and module
                    access, reset password, activate/deactivate, delete)
                    and Mobile Demo (phone-sized preview of the worker side)
stock/              Stock module: the worker (estate_user) view of the
                    Plantation Stock app, moved here from
                    oliviawsc/plantationstockmanagementsystem
shared/config.js    Supabase URL / anon key, session keys
shared/auth.js      Sign-in, sessions, worker rows (opp_users)
shared/modules.js   Module list shown on the worker home; Stock access items
shared/i18n.js      EN / BM text
shared/style.css    Shared styles
```

## Accounts and access

- Workers are rows in `opp_users` with `permissions.__role = 'estate_user'`
  (the same rules as the Stock app). Their User ID is stored as
  `<id>@psms.app`.
- Stock access is set per item (Baja, Racun, Anak Sawit, Hujan, Peralatan) as
  None, View or Edit. Workers only see the Stock card if at least one item
  is not None.
- Only the Super Admin (`hqadmin.puigroups@gmail.com`, Supabase Auth) can
  open `admin.html`.
- The worker session uses the same storage key as the Stock app
  (`opp_auth_session`), so signing in here opens Stock straight away. The
  admin session uses a separate key, so the Mobile Demo can sign in a worker
  without signing the admin out.

## Adding a module

1. Put the module's pages in a new folder (for example `harvest/`).
2. Add an entry to `MODULES` in `shared/modules.js` (icon, name, URL, and
   who is allowed to see it).
3. If it needs per-worker access settings, add them to the admin edit
   dialog in `admin.html`.

## Link from the Stock app

When an `estate_user` signs in to the Stock app, the app sends them here
(`WORKER_PORTAL_URL` in that repo's `index.html`).
