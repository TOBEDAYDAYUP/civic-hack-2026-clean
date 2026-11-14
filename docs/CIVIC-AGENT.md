# Civic Source Agent

## Run locally

Use Node.js 22 or later. From the repository root, set up the public read-only connection and run the agent.

```sh
node scripts/setup-env.mjs
node --env-file=.env.local scripts/civic-agent.mjs --report=civic-agent-preview.json
```

The default run reads both sources and prints record counts and the number of agenda items pending review. The optional report includes source records, hashes, errors, and proposed agenda links. It stays on your machine and the command requires a new filename for each saved report. If one source fails, the agent still attempts the other and exits with status 1. A saved report lists which source failed and includes any records successfully collected.

To run the public voting source independently, use `node scripts/civic-agent.mjs --source=votes`. Use `--source=notices` with the public connection when checking only the notice archive.

## Run on GitHub Actions

The Civic Source Agent workflow runs a read-only collection at minute 17 of every hour once the workflow is on the default branch. Open **Actions → Civic Source Agent → Run workflow** to trigger a run manually after merge. Each run logs the number of notices, vote rows, and agenda items pending review. The workflow uses the public notice configuration from the repository template.

## Source coverage and review

- Public notices come from the existing Supabase `civic_source_notices` archive. The existing administrator sync refreshes that archive from Toronto.
- [Toronto Open Data](https://open.toronto.ca/dataset/members-of-toronto-city-council-voting-record/) provides recorded member votes. The collector selects the latest active council-term resource and reads up to 100 rows in descending source row ID order. Each row represents a member's vote on a motion.
- The preview preserves the source URL, resource and row identity, source date text, payload, and content hash. Exact official agenda identifiers group vote rows into agenda items pending human review. Records without an unambiguous identifier remain in the source records.

## Write to Supabase

Apply [the Agent ingestion migration](../supabase/migrations/20261114003000_civic_agent_ingestion.sql) to a test Supabase project first. The migration adds private staging tables and the service-role ingestion function. It can also be run in the test project's SQL Editor.

Keep the public notice settings in `.env.local`. Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in a private local environment file for the Supabase write target. The agent reads notices using the public settings, so the test destination can be separate from the source archive.

```sh
node scripts/setup-env.mjs
node --env-file=.env.local scripts/civic-agent.mjs --write
```

The command submits up to 500 records per transaction. Repeat it to verify that rows are updated by source identity without duplicates. Check the resulting counts in the target project's SQL Editor.

```sql
select source, count(*)
from public.agent_sources
group by source
order by source;
```

A changed source sends confirmed links back for review. An agenda identifier correction removes the previous automatic link and timeline entry. The GitHub Actions schedule continues to run in read-only mode. Historical backfill, run history, and a review interface remain future work.

## Agent tests

```sh
node --test tests/civic-agent.test.mjs
```
