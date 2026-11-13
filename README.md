# CIVIC Hack 2026 — Your City Council

A Next.js civic-information prototype for making Toronto municipal information easier to find and understand.

## Current prototype

- Recreated Toronto decision feed with search, filters, saved items and participation links
- Live City of Toronto Public Notices ingestion endpoint
- Local AI simplification with Ollama + `qwen3.5:4b`
- Structured AI output with conservative prompts that forbid invented deadlines, locations or decision stages
- Manual **Update data** workflow that fetches new/changed records, simplifies them and stores the processed JSON locally
- Official-source links remain the source of truth

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For AI-powered updates, have Ollama running and install the model:

```bash
ollama pull qwen3.5:4b
```

Then click **Update data** on the homepage, or run:

```bash
npm run data:update
```

## API routes

- `GET /api/toronto/notices?limit=5`
- `GET /api/processed-notices`
- `POST /api/ai/simplify`
- `POST /api/sync`

## Prototype architecture

Toronto public data → normalization → local Qwen/Ollama simplification → structured JSON → Next.js UI.

The AI layer is intentionally decoupled from normal website viewing: processed content can be displayed without requiring visitors or judges to install Ollama.

## Important data note

Toronto Public Notices are not automatically equivalent to final Council decisions. The product must preserve the actual decision stage and always link back to the official source.

## CIVIC Hack disclosure

This project uses open municipal data, open-source libraries, and AI-assisted development. AI assistance and model usage should be disclosed in the final Devpost submission.
