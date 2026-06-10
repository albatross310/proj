# DotComma — Performance / Readability / Stability Audit

> **Implementation status (2026-06-10).** Most of this audit has been actioned.
> Per the owner's call, the Socket.IO and email-code subsystems were **kept and
> made live** rather than deleted:
> - **Done (backend):** async scrypt (S4); `pool.on('error')` (S5); DB indexes
>   (P4); in-memory rate limiting on all auth routes (S6); CORS allowlist via
>   `CORS_ORIGINS` (S10); throttled `last_seen_at` (P3); **forgot-password flow**
>   (`/api/auth/forgot/start` + `/reset`, reusing the email-code machinery — S3
>   resolved by *use*, not deletion).
> - **Done (frontend):** Socket `validated` is now **wired into the live word
>   colours** (server-authoritative, local fallback — S2 resolved by use, P1
>   kept for anti-cheat); forgot-password UI; `API_URL` via `VITE_API_URL` (R4);
>   removed dead deps `framer-motion` + `@vitejs/plugin-react` (R3) and dead
>   state `submitted`/`authStep` (R2); hoisted styles to `styles.js` (P5);
>   keydown listener no longer re-subscribes per keystroke (P6); extracted
>   `api.js`, `socket.js`, `messages.js`, `styles.js`, `useAuth`, `useTopAnswers`
>   (part of R1). `App.jsx` 1057 → ~770 lines.
> - **Deferred:** splitting the six page views into separate component files
>   (the rest of R1). Judgment call — the *logic* is now extracted to
>   hooks/modules, but moving the page JSX into files with prop-threading is
>   organisational and carries regression risk best paired with colocating
>   `text` state into a `GamePage` (which would also cut the per-keystroke
>   whole-tree re-render). Left as a focused follow-up. S7 (every answer public)
>   and S8/S9 left as noted — product decisions, not bugs.


**Scope:** `backend/` (Fastify + Postgres/Neon + Socket.IO) and `frontend/proj/app/`
(React Router v7 framework mode, SSR on Vercel; the game is one 1057-line `App.jsx`).
**Method:** full read of every source file (~3.5k lines) + dependency/usage greps. No code
changed. Every claim is cited to `file:line`. Severity: 🔴 high · 🟠 medium · 🟢 low/cosmetic.

## What's already good (don't "fix" these)

- **Hooks are all declared before the first early `return`** (`App.jsx:70-510`, first return at
  `:513`). The multi-page early-return pattern is currently *correct* — no conditional-hook bug.
  (It's fragile, though — see R1.)
- **SSR safety is handled:** every `localStorage`/`window`/`navigator` access is inside an effect
  or event handler (client-only), and `getSocket()` is `typeof window` guarded
  (`App.jsx:25-30`). Preference state defaults deterministically to avoid hydration mismatch
  (`App.jsx:96-99`). Don't add `typeof window` guards that aren't needed.
- Parameterised SQL everywhere (`$1,$2…`) — no injection surface. Codes/passwords/tokens are
  hashed at rest; `timingSafeEqual` for passwords (`auth.js:26`). Token TTLs enforced in SQL.

---

## 🔴 Top 5 highest-leverage changes

1. **Delete the entire Socket.IO validation path — it is dead code (P1/S2).**
2. **Resolve the orphaned email-code auth subsystem (S3).**
3. **Split `App.jsx` (1057 lines) into route/page components + hooks (R1).**
4. **`scryptSync` blocks the event loop on every sign-in — make it async (S4/P2).**
5. **`last_seen_at` is written on *every* authenticated request — throttle it (P3).**

---

# Stability

### 🔴 S2 — The Socket.IO live-validation round-trip is entirely dead
`validated` is declared (`App.jsx:71`) and set from the socket (`:279`) but **never read** —
confirmed by grep, its only two occurrences are the declaration and the setter. The visible
word colours come from `getColor` (`App.jsx:113-119`), a *local, synchronous* lookup against
`allowedWords`. So this whole chain does nothing observable:
- frontend debounce emit on every keystroke (`App.jsx:265-272`),
- frontend listener (`:275-282`),
- backend `io.on("connection") … socket.on("validate_text")` (`server.js:19-25`),
- the `socket.io` server dep + `socket.io-client` frontend dep.

**Fix:** delete all of the above. Validation is already 100% local and instant. This removes a
persistent WebSocket connection, a per-keystroke network round-trip, and a sizable client
bundle — the single biggest perf + complexity win in the repo. (See P1.)

### 🔴 S3 — Orphaned email-code auth subsystem (dead attack surface + confusion)
The UI was migrated to **email + password** (`App.jsx:615-667` posts only to
`/api/auth/password`). The older **email-code** flow is still fully present on the backend but
no longer reachable from the UI:
- `authStep` state is set to `"email"` (`App.jsx:89,199`) but **never read** (grep-confirmed),
- backend `/api/auth/start` + `/api/auth/verify` (`server.js:31-49`), `startSignIn` /
  `verifySignIn` / `sendCode` + the Resend integration (`auth.js:110-192`), and the
  `login_codes` table (`db.js:63-70`) are all unused by the client.

This is dead, unmonitored, internet-exposed endpoints (e.g. `/api/auth/start` still sends real
emails via Resend). **Decision needed — flagging, not assuming:** either (a) delete the
code-auth endpoints, `sendCode`, and `authStep`, or (b) if email-code sign-in is still a planned
product path, wire it back into the UI. Right now it's the worst of both: live but orphaned.

### 🔴 S4 — `crypto.scryptSync` blocks Fastify's single event loop
`hashPassword`/`verifyPassword` call `scryptSync` (`auth.js:16,23`), which is CPU-heavy
(~50-100ms) and **synchronous** — it stalls the whole server for every sign-up/sign-in while it
runs. Under even light concurrent login load this serialises all requests.
**Fix:** use the async `crypto.scrypt` (callback/promisified) so the work yields the loop.

### 🟠 S5 — No `pool.on('error')` handler → idle-client error crashes the process
`db.js:14-18` creates the Pool but never attaches an error listener. Neon drops idle
connections; when `pg` surfaces that on an idle client with no listener, it's an unhandled
'error' event that can take the process down. **Fix:** `pool.on('error', (e) => console.error(e))`.

### 🟠 S6 — No rate limiting on auth endpoints
`/api/auth/password` has no lockout/throttle → online password guessing is unbounded (the
`login_codes` attempt cap at `auth.js:162` only protects the dead code path). `/api/auth/start`
is an unauthenticated trigger for Resend emails → email-bomb / cost amplification. **Fix:**
add `@fastify/rate-limit` (per-IP, and ideally per-email on the auth routes).

### 🟠 S7 — Every answer is public despite the "privacy-safe default"
The server defaults to private unless `visibility === "public"` (`server.js:131`, comment
"privacy-safe default"), but the client **always** sends `visibility: "public"`
(`App.jsx:476`) with no opt-in UI, and the DB column default is `'public'` (`db.js:40`). So the
stated privacy posture isn't realised — every submitted answer is public and appears in
top-answers. Flagging as an intent/behaviour mismatch to resolve (add the opt-in, or change the
default + messaging).

### 🟢 S8 — User-enumeration via differing auth responses
`passwordSignIn` (`auth.js:40-72`): unknown email → account silently created (success); known
email + wrong password → `"Wrong password."`. The difference reveals which emails are
registered. Low severity for this app; note if accounts ever hold sensitive data.

### 🟢 S9 — `message_state` rotation has a benign race
`nextMessageIndex` (`server.js:88-110`) does `SELECT last_index` then upsert — two concurrent
submits can read the same `last_index` and repeat a title. Cosmetic. Could fold into one
`UPDATE … RETURNING` or compute in SQL.

### 🟢 S10 — `CORS origin: "*"` (`server.js:11,16`)
Safe-ish here because auth is Bearer-token-in-header (not cookies), so there's no ambient-
credential CSRF. Still worth pinning to the known origins (`dotcomma.com.au`, the Vercel
preview domains) once they're stable.

---

# Performance

### 🔴 P1 — Remove Socket.IO (see S2)
Deleting the dead validation path removes: a live WebSocket per client, a 100ms-debounced emit
on every keystroke, the `socket.io` (server) and `socket.io-client` (client, ~tens of KB
gzipped) dependencies. Net: smaller bundle, fewer connections, less server work, simpler deploy.

### 🔴 P2 — Async-ify `scrypt` (see S4)
Same change, framed as throughput: the sync hash serialises the event loop; async scrypt lets
concurrent requests proceed while the KDF runs on the threadpool.

### 🟠 P3 — `last_seen_at` written on every authenticated request
`getUserForRequest` runs an `UPDATE users SET last_seen_at = now()` on **every** authed call
(`auth.js:207-211`) — so each `GET /api/me`, each top-answers load, each like, is *two* DB
round-trips and a write. On Neon (pooled, `max: 5` — `db.js:17`) this is real write load and
pool pressure. **Fix:** throttle (e.g. only update when `last_seen_at < now() - interval '5
min'`, doable in the same SELECT's `WHERE`-gated UPDATE), or drop it to a periodic job.

### 🟢 P4 — Missing indexes for the join/FK columns
`idx_answers_prompt_key` exists (good). But `answer_votes.answer_id`, `answers.user_id`, and
`sessions.user_id` are unindexed (`db.js`). The top-answers query LEFT JOINs `answer_votes` on
`answer_id` and GROUPs (`server.js:180-193`); add `CREATE INDEX … ON answer_votes(answer_id)`.
(`sessions.token_hash` and `answer_votes(answer_id,user_id)` are already indexed via UNIQUE.)
Low impact at current scale, cheap to add.

### 🟢 P5 — Per-render style-object churn
Every render rebuilds `containerStyle`, `boxStyle`, `buttonStyle`, `menuItemStyle`, etc.
(`App.jsx:120-151`) plus dozens of inline literals. They depend on nothing — **hoist the static
ones to module scope** (or CSS classes; `App.css` already exists). Frees allocations and makes
`React.memo` viable later. Minor but free.

### 🟢 P6 — `keydown` listener re-subscribes on every keystroke
The Enter/Backspace effect depends on `[text, page]` (`App.jsx:510`); since `text` changes each
character, the listener is removed+added every keystroke. Read `text` from a ref (or call
`submitAnswer` via a ref) and depend on `[page]` only.

---

# Readability / Maintainability

### 🔴 R1 — One 1057-line `App` component holds every page, all state, all effects
`App.jsx` has ~30 `useState`/`useRef`, 8 effects, and six full page-views rendered via early
returns (settings/account/about/intro/results/game). Everything re-renders on every keystroke
and every state change; the file is the project's main maintenance risk. **Fix (incremental):**
- Lift each page into its own component (`<GamePage>`, `<ResultsPage>`, `<AccountPage>`, …),
  driven by the existing `page` state or — better — real routes (you already use RR v7;
  `routes.js:1-7` only has `/`, `/about`, `/how-to-play`).
- Extract cohesive hooks: `useAuth()` (user/session/sign-in/out), `useTopAnswers()`
  (fetch/sort/like), `useGameProgress()` (prompt/reveal/results).
- Move the static style objects to `App.css` classes.

### 🟠 R2 — Dead state & variables (remove)
- `submitted` (`App.jsx:74`) is always `[]`, only mapped at `:1047` — dead UI branch.
- `validated` (`:71`) — dead (S2).
- `authStep` (`:89`) — dead (S3).
- `resultText` is computed at component scope (`:110`) and again, shadowing, inside the results
  block (`:768`); the outer one looks unused.
- Commented-out token/word lines (`:72-73`).
- Exports `correctAnswers`, `answers` (`prompts.jsx:77,79`) aren't imported anywhere in `App`.

### 🟠 R3 — Dead dependencies (remove from `package.json`)
- **`framer-motion`** — grep-confirmed **not imported anywhere**. Pure install/bundle bloat.
- **`@vitejs/plugin-react`** (devDep) — `vite.config.js:4-7` explicitly says it's not needed in
  framework mode. Remove.

### 🟠 R4 — `API_URL` hardcoded (`App.jsx:17-19`)
Points at `https://proj-1o7w.onrender.com` literal while the product domain is
`dotcomma.com.au`. Move to `import.meta.env.VITE_API_URL` so prod/staging/preview don't require
a code edit (and the URL isn't a renamed-service landmine).

### 🟠 R5 — Word list duplicated, frontend vs backend
`frontend/proj/app/words.js` and `backend/words.js` are byte-for-byte the same list + merge
rules (both carry a `TODO (spec Phase 7)` admitting it). Drift = client colour and server score
disagree. **Fix:** one shared source (a published package, a generated file, or a backend
endpoint the client fetches once).

### 🟢 R6 — Brittle reveal-index arithmetic
The retry path computes `introCount + 1 + (hasClue ? 1 : 0) + 1` (`App.jsx:294-296`) and the
game body recomputes stage offsets inline (`:897-908`). This positional math breaks if the
stage layout changes. Encapsulate the reveal sequence as a small state machine / derived list so
the offsets have one definition.

### 🟢 R7 — Leftover scaffolding noise
`// s1` markers (`server.js:2,8,10,14,15,19,27`; `App.jsx:1058`), commented code (`:72-73`),
and inconsistent JSX formatting (`style = {buttonStyle}`, zero-indented returns). A Prettier
pass + a sweep would clean these.

### 🟢 R8 — Single-prompt content
`prompts.jsx:10-21` defines exactly one prompt block, so `promptIndex`/multi-prompt machinery is
currently exercised with N=1. Fine, but worth noting the navigation code (Continue/Go Back,
`promptIndex` bounds) is largely untested against real multi-prompt data.

---

## Suggested order of work

1. **Delete dead weight first** (lowest risk, big clarity gain): Socket.IO path (S2/P1),
   `framer-motion` + `@vitejs/plugin-react` (R3), dead state `submitted`/`validated`/`authStep`
   (R2), `// s1`/commented lines (R7). The file shrinks and the next steps get easier.
2. **Decide on email-code auth** (S3) — delete or rewire; don't leave it orphaned.
3. **Backend hardening:** async scrypt (S4), `pool.on('error')` (S5), rate-limit auth (S6),
   throttle `last_seen_at` (P3), add the votes index (P4).
4. **Config:** `API_URL` → env (R4); single word-list source (R5).
5. **Then the big refactor:** split `App.jsx` into page components + hooks (R1), hoist styles
   (P5), fix the keystroke listener (P6). Do this last so it's done over clean, dead-code-free
   ground.

Items 1-4 are mostly mechanical and high-confidence; item 5 is the structural investment that
makes the codebase pleasant to extend (more prompts, the "My answers" feature stubbed at
`App.jsx:232`, etc.).
