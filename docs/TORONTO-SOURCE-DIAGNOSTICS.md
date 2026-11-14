# Toronto source timeout diagnostics

Run this independent probe from the repository root. It does not import the source-sync program, acquire a database lease, run an agent, or write database records.

```sh
node --env-file=.env.local scripts/diagnose-toronto-source.mjs --long-timeout-seconds=120 --report=/tmp/toronto-source-report.json
```

Without a local environment file, use `node scripts/diagnose-toronto-source.mjs`. The public database comparison is then skipped unless its public settings are already in the environment. Existing report files are never overwritten; use a different path for each run.

The same comparison runs in **Toronto source diagnostics** on pull requests touching the diagnostic files, and can be manually dispatched once merged into the default branch. It requires no Actions Secrets. Its endpoint-probe step allows an unreachable source so the diagnostic artifact can still be collected; job success is not proof of successful source ingestion. Read each result's `ok`, `status`, `stage`, timings and byte count in the JSON artifact.

## Comparison

| Probe | What it measures |
| --- | --- |
| `source-current-sync-headers` | The exact official JSON URL and headers used by the current sync, without the database logic |
| `source-default-fetch-headers` | The same source using Node's default User-Agent |
| `source-curl-ipv4-default-headers` | An independent curl request forced to IPv4, with DNS/TCP/TLS/first-byte timing |
| `source-long-timeout-current-headers` | Optional 120-second attempt if none of the first source probes succeeds |
| `control-teammate-voting-api` | The teammate agent's separate CKAN voting dataset metadata endpoint |
| `control-teammate-notice-archive` | One record from the teammate agent's existing public Supabase notice archive |

The teammate's `scripts/civic-agent.mjs` reads notices already in Supabase and votes from Toronto Open Data CKAN. It does **not** download `https://secure.toronto.ca/nm/notices.json`. Success in that agent does not establish that the official notice export is reachable.

## Reading results

- A Node timeout in `waiting-for-headers` means no HTTP response headers arrived before the deadline; the program has not reached JSON parsing or source normalization.
- A curl result with successful TCP/TLS times, zero `headersMs`, zero bytes and exit code 28 narrows the delay to waiting for an HTTP response. It does not distinguish an origin-server delay from filtering or a network intermediary.
- `reading-body` identifies a response that started and then stalled while downloading.
- HTTP status is retained, including 403/429/5xx. A 200 HTML page is not counted as valid JSON.
- If a longer attempt succeeds, compare the actual elapsed time before changing production timeouts. A longer timeout alone does not repair a stalled or denied endpoint.
- To distinguish local network effects, run this exact command on the teammate's computer at approximately the same time and compare it with the GitHub report. Comparing different endpoints cannot establish which machine or program is responsible.

Reports include only runtime information, public source DNS results, status codes, timing and JSON record counts. They exclude source bodies, contact data, headers and keys. Only public read-only database settings are used; administrator keys are never read by this script.

Offline classification tests:

```sh
node --test tests/source-diagnostics.test.mjs
```

## Verified finding (2026-11-13, Toronto local date)

In a same-machine run, both original-header and default-header source requests timed out at 45 seconds without HTTP headers. An independent IPv4 curl probe completed TLS in 54 ms but received no HTTP bytes within 45 seconds. A separate 120-second source probe succeeded with HTTP 200: headers arrived after 92.245 seconds, with a 22,669,452-byte JSON body completed in 93.161 seconds. The teammate's unchanged agent independently validated 2,983 archived notices and 100 votes.

This demonstrates that the previous 45-second source deadline was too short for at least this successful export. It does not prove every timeout has the same cause or that all networks behave identically. The active Node source-sync deadline is raised to 120 seconds, below the existing 180-second database lease, and source timeouts now identify whether headers or the body stalled. No database schema change is needed.

### Second failure uncovered after the HTTP fix

The first live ingestion with the longer HTTP deadline reached the database but failed with HTTP 500. The project Postgres log at `2026-11-14T02:28:09.356Z` explicitly reported `canceling statement due to statement timeout`. The service role had no override and inherited the authenticator role's 8-second statement timeout.

The administrator approved migration `20261114023826_allow_notice_sync_commit_45_seconds.sql`, which sets a 45-second timeout only on `public.civic_commit_source_sync(uuid,jsonb)`. Verification confirmed it remains SECURITY INVOKER, executable by service_role and not anon. This preserves the existing table and privilege model. With a 120-second source deadline and a 45-second commit deadline, both budgets fit the existing 180-second lease with a small normalization margin. The migration includes its rollback command.
