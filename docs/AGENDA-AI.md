# Upcoming agenda summaries

The page reads official meetings from `civic_agenda_snapshot` and public summaries from `civic_agenda_summaries`. Summary rows are separate from the official snapshot, so scheduled source refreshes do not erase them. Each row is tied to a hash of the official item reference, title, date, committee and analysis version. Changed or rejected results are hidden immediately; visitors can still read the official item.

## Local administrator

Use the existing private `.env.local` with `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `OLLAMA_BASE_URL` and `OLLAMA_MODEL`. The existing default model is `qwen3.5:4b`.

```sh
npm run agenda:analyze
```

This generates short headlines and one-sentence descriptions from the official title and meeting metadata. It does not invent report details, a decision, affected residents or deadlines. The page labels the simplified summaries and links to the complete official item. Generation rejects changed addresses, unsupported numbers, parties or decisions and retries a rejected result once.

Run continuously on the administrator computer to process new or changed agenda items:

```sh
npm run agenda:analyze -- --watch
```

The watcher checks the shared snapshot every 60 seconds and skips matching cached results. The computer and Ollama must remain running for new summaries; already-published summaries remain readable when the worker is offline. Ctrl+C stops after the in-flight item. `--max=10` limits each cycle, `--dry-run` previews without database writes, and `--force` regenerates a single batch. `--force` cannot be combined with `--watch`.

The website never calls the local model during a visitor request. Publishable keys can read summary rows but cannot write them. Administrator keys remain server-side. The migration enables RLS with a public SELECT policy and grants writes only to service_role. No existing agenda ingestion or voting logic changes.

## Verify

```sh
node --test tests/agenda-analysis.test.mjs
npm run check
```

The page offers search, committee and date filters. Meeting groups are sorted by date, with one group expanded at a time. Original references remain visible and searchable, while administrative folder numbers are kept out of headlines.
