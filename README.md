# Oonchai

**Your story begins here.** Meet a character, create a scenario, and become anyone in an original AI roleplay world. Sekaira is the development codename for Oonchai.

[Open Oonchai](https://oonchai.vercel.app/)

## What you can do

- Create a character and start a standalone conversation without a world, scenario, or persona.
- Build a world, choose a persona, bring in characters, and play through a scene together.
- Keep conversations and scoped memories across sessions, with private and shared character visibility.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Set `GROQ_API_KEY` in `.env.local` for AI replies. Local development uses SQLite at `data/sekaira.sqlite` when `DATABASE_URL` is unset. `ALLOW_GUEST=true` in the example environment enables a local guest session; production disables guest mode.

Google sign-in requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the matching `APP_URL` and OAuth callback configuration. `TAVILY_API_KEY` is optional for character and world research. Keep all keys server-side and out of Git.

## Verify

```bash
npm run typecheck
npm test
npm run build
```

`npm run test:postgres` is the separate PostgreSQL integration suite and requires a test database. Production uses PostgreSQL via `DATABASE_URL`; schema migrations live in [`supabase/migrations`](supabase/migrations).

## More detail

- [Product journeys and data boundaries](docs/architecture.md)
- [LLM model configuration](docs/llm-configuration.md)
- [Anubis gateway deployment](docs/anubis.md)
