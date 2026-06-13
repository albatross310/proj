# DotComma

A constrained-language word game — say more with short, plain words.
Live at [dotcomma.com.au](https://dotcomma.com.au).

## Layout

- `frontend/proj/` — React Router v7 (SSR) + Vite app, deployed on Vercel
- `backend/` — Fastify + Postgres (Supabase) API, deployed on Render
- `content/` — **the prompt deck and vocabulary live here**, as plain text
- `scripts/build-content.mjs` — compiles + lints content into the JSON the
  app actually reads (`backend/shared/`, `frontend/proj/app/shared/`)

## Adding a prompt

Edit `content/prompts.txt`, then from the repo root:

```
node scripts/build-content.mjs
```

Fix anything the lint flags, commit (including the regenerated JSON), and
push. See [content/AUTHORING.md](content/AUTHORING.md) for the format, the
vocabulary's quirks, and scoring.
