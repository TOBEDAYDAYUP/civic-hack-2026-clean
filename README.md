# CIVIC Hack 2026 — Your City Council

A Next.js civic-information prototype for making Toronto municipal information easier to find and understand.

## Current prototype

- Recreated Toronto decision feed with search, filters, saved items and participation links
- Live City of Toronto Public Notices ingestion endpoint
- Local AI simplification with Ollama + `qwen3.5:4b`
- Structured AI output with conservative prompts that forbid invented deadlines, locations or decision stages
- Manual **Update data** workflow that fetches new/changed records, simplifies them and stores the processed JSON locally
- Official-source links remain the source of truth

## Team workflow

Use Node 22 (`nvm use`). Read [CONTRIBUTING.md](CONTRIBUTING.md) for module ownership, short task branches and PR checks. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the code map.

The detail pages now explain facts, relevance, missing evidence and next steps. Housing records retain the five-stage verification guide. Open a card or visit `/decisions/3`. These curated pages work without a database or Ollama.

## Run locally

```bash
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY first.
npm ci
npm run dev
```

Open http://localhost:3000.

## Shared data and updates

The notice feed reads the shared Supabase database. Everyone sees the same stored notices; database changes trigger realtime refresh, with a 30-second fallback. No secret key or Ollama is required to browse.

Source ingestion is **administrator-triggered**, as requested. Run `npm run data:sync` with private local administrator settings. No unattended schedule is enabled. Toronto upstream failures are reported without erasing existing data. See [docs/DATA-API.md](docs/DATA-API.md) for setup, endpoints and verification.

AI explanations remain optional and are displayed only when their source hash is current. Raw official notices remain readable without them.

## Important data note

Toronto Public Notices are not automatically equivalent to final Council decisions. The product must preserve the actual decision stage and always link back to the official source.

## CIVIC Hack disclosure

This project uses open municipal data, open-source libraries, and AI-assisted development. AI assistance and model usage should be disclosed in the final Devpost submission.

## Validate before merging

```bash
npm run check
```

GitHub Actions runs the same checks on PRs and main. Branch protection must be enabled separately by a repository administrator; see CONTRIBUTING.md.

## Working with teammates and AI

Start with [the team Git workflow](docs/GIT-WORKFLOW.md). Use one short-lived branch per task and a reviewed PR to main. AI agents must read [AGENTS.md](AGENTS.md) before editing.

Database connection settings come exclusively from environment variables. Source code includes no project-specific URL or key fallback. See `.env.local.example`; keep actual values in ignored `.env.local`.
