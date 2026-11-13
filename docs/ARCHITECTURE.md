# Code map

- `app/page.tsx` mounts `components/CityCouncilApp.tsx`, which coordinates filters, saved IDs and local notices.
- Feature components own their UI in `features/decisions`, `features/map`, `features/notices`, and `features/participation`.
- `app/decisions/[id]/page.tsx` reads curated records and renders `features/records/RecordPageFrame.tsx` plus `CuratedRecordDetails`.
- Housing records use `HousingPipelineDetail` for facts, interpretation, five unverified stages, missing evidence, and official verification links.
- `features/records/recordContext.ts` supplies editorial context keyed to curated decision IDs. It is interpretation, not additional source evidence.
- `app/notices/[id]/page.tsx` reads the shared Supabase notice feed. `LiveRecordDetails` presents its structured AI fields.
- `features/records/records.css` is loaded by detail-route layouts. The home theme stays in `app/globals.css`.
- Shared read APIs and protected administrator writes are documented in DATA-API.md.

The clean repository imported the original main snapshot at ae6f21e. Only the requested record-detail UI and its editorial context were ported from the old local team-merged version; its database and background-sync integration were not ported.

## Checks

`npm run check` runs TypeScript, the Next.js production build, and HTTP smoke tests against a temporary local production server. The tests exercise all curated detail URLs, housing/non-housing sections, invalid IDs, and the processed-notices API. They explicitly use local test mode and require no external service.

Manual UI checks: open a housing card and another topic, return to Decisions, filter/search, save a record and refresh, and check a narrow screen. For live notices, use locally generated records and confirm source links and uncertainty fields. The empty initial notice dataset is expected.

The API integration now reads shared raw notices and hash-matched AI summaries; source ingestion is manual and Realtime refreshes subscribers. See DATA-API.md.
