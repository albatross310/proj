# Supabase Auth — setup checklist

Authentication migrated from the custom email/scrypt system to **Supabase Auth**.
The client (frontend) signs users in/up and handles password reset; the backend
just **verifies the Supabase access token** and maps each auth user to a row in
the `users` table (via a new `auth_id` column). Answer storage + server-side
validation are unchanged.

Nothing below works until you do these steps — the app builds and runs without
them, but sign-in stays disabled (you'll see "Sign-in isn't configured yet").

## 1. Supabase dashboard

- **Authentication → Providers → Email:** make sure Email is enabled.
  - **"Confirm email"** toggle: turn **OFF** for instant accounts (matches the
    old one-tap sign-up UX). Leave **ON** if you want users to confirm via email
    before they can sign in (the UI handles both — it shows a "check your email
    to confirm" note).
- **Authentication → URL Configuration:**
  - **Site URL:** `https://dotcomma.com.au`
  - **Redirect URLs:** add the reset-password landing page for every origin:
    - `https://dotcomma.com.au/reset-password`
    - `http://localhost:5173/reset-password` (local dev)
    - your Vercel preview origin if you use one, e.g. `https://*.vercel.app/reset-password`
- **(Optional) Authentication → Email Templates:** customise the "Reset password"
  and "Confirm signup" emails. The reset link must point at `…/reset-password`.

## 2. Environment variables

**Frontend** (Vercel project env, or `frontend/proj/.env` locally):
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co        # Settings → API → Project URL
VITE_SUPABASE_ANON_KEY=<anon public key>                   # Settings → API → anon public (safe to expose)
VITE_API_URL=https://<your-backend>                        # the Fastify backend
```

**Backend** (Render env, or `backend/.env` locally — see `backend/.env.example`):
```
DATABASE_URL=...                       # already set (Supabase Session-pooler URI)
SUPABASE_JWT_SECRET=<JWT secret>       # Settings → API → JWT Settings → JWT Secret
# CORS_ORIGINS=https://dotcomma.com.au,...   # optional; defaults are sensible
```

## 3. Database migration (automatic)

The backend's `db.init()` runs on boot and is idempotent. On next deploy it will:
- add `users.auth_id uuid` (+ unique index),
- **drop** the now-unused `sessions` and `login_codes` tables and the
  `users.password_hash` column (destructive — old custom-auth sessions/codes go away).

Existing answers keep working. If a legacy user had a row with the same email,
the first time they sign in via Supabase that row is linked by `auth_id` (so they
keep their display name + answer history); otherwise a fresh profile row is created
with a generated display name.

## 4. Heads-up on JWT verification

The backend verifies the access token as a standard **HS256** JWT using
`SUPABASE_JWT_SECRET` (`backend/auth.js`). This is the default for existing
Supabase projects. **If you've enabled Supabase's newer asymmetric JWT signing
keys** (ECC/RSA, "JWT Signing Keys" in the dashboard), HS256 verification won't
match — tell me and I'll switch the backend to verify via JWKS (or via a call to
`/auth/v1/user`).

## What changed (for review)

- **Removed:** custom auth endpoints (`/api/auth/*`), scrypt, `sessions` +
  `login_codes` tables, the code-based reset.
- **Added:** `supabaseClient.js`, Supabase-based `useAuth`, rewritten
  `AccountPage` (sign-in/up + send reset link), `/reset-password` route, backend
  JWT verification + `users.auth_id` mapping.
- **Kept:** server-authoritative answer validation (anti-cheat), the answers /
  votes schema, the Socket.IO live-validation, display-name editing.
