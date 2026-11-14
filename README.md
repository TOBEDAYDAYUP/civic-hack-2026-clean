# CIVIC Hack 2026 — Your City Council

A Next.js civic-information prototype for making Toronto municipal information easier to find and understand.

## Current prototype

- A single Home feed for Supabase-backed Toronto Public Notices, with full-record search, newest/oldest ordering, one category selector and bookmarks for actual notices
- Live City of Toronto Public Notices ingestion endpoint
- Local AI simplification with Ollama + `qwen3.5:4b`
- Structured AI output with conservative prompts that forbid invented deadlines, locations or decision stages
- Manual **Update data** workflow that fetches new/changed records, simplifies them and stores the processed JSON locally
- Official-source links remain the source of truth

## Team workflow

Use Node 22 (`nvm use`). Read [CONTRIBUTING.md](CONTRIBUTING.md) for module ownership, short task branches and PR checks. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the code map.

Notice detail pages explain facts, relevance, missing evidence and next steps. Open a notice from Home or Map to visit `/notices/<id>`. The Decisions tab contains the restored archive of 14 static curated summaries, with search, topic filters, sorting, bookmarks and structured detail pages at `/decisions/<id>`. These records do not update with the live public-notice feed; verify them against original Council records.

## Run locally

```bash
npm ci
npm run dev
```

Open http://localhost:3000.

## Shared data and updates

The notice feed reads the shared Supabase database. Everyone sees the same stored notices; database changes trigger realtime refresh, with a 30-second fallback. No secret key or Ollama is required to browse.

Source ingestion is scheduled hourly by `.github/workflows/toronto-source-sync.yml` (minute 17 of each hour, UTC), once merged into `main` and configured with the repository Actions secrets `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. GitHub schedules may be delayed. Administrators can also run `npm run data:sync` manually. Toronto upstream failures are reported without erasing existing data. See [docs/DATA-API.md](docs/DATA-API.md) for setup, endpoints and verification.

AI explanations remain optional and are displayed only when their source hash is current. Raw official notices remain readable without them.

## Home filters and bookmarks

- The Home page is the only municipal notice feed. Its **Search**, **Sort by** (newest/oldest) and **Category** (Transportation, Housing, Taxes & Budget, Infrastructure, Other) controls work together.
- Sorting uses the original notice date; unknown dates sort last. Topic categories are rule-based from official topic labels and source titles (not independent validation of decision stages).
- Search/category filtering is done server-side **before** paging, across all stored notices, not just the visible 12. Since the current Supabase view lacks a normalized category column, filtered requests scan the notice archive with a brief 15-second in-process cache. This works without a database migration but should be replaced with a database-indexed category if the volume becomes large. The browser limit is currently 20,000 records.
- **Saved** now bookmarks Supabase public-notice IDs in this browser only. Static decision bookmarks use the separate `yc-saved` store and appear below saved public notices; numeric decision IDs are never sent to the public-notice bookmark API.
- Map, Participate, and the `/notices/[id]` source-backed details are unchanged.

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

Database connection settings are read from environment variables. `npm run dev` and `npm run build` automatically fill missing public read-only settings from `.env.local.example` into the ignored `.env.local`. Existing valid custom settings and all administrator settings are preserved. Ordinary teammates do not need their own Supabase project or administrator key. See [team setup](docs/TEAM-SETUP.md).
