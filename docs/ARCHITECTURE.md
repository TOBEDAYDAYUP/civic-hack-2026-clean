# Code map

- `app/page.tsx` mounts `components/CityCouncilApp.tsx`, the Home / Map / Participate / Saved controller. The old Decisions tab and 14 hardcoded curated records have been removed.
- `features/notices/NoticeFeed.tsx` owns Home/Saved search, sort, category dropdown and page controls; cards link to `/notices/[id]`.
- `lib/notice-browser.mjs` defines the normalization rules used to assign official notices to Transportation, Housing, Taxes & Budget, Infrastructure or Other. The original source topics are preserved in Supabase.
- `/api/notices` calls `lib/public-notices.ts`. Normal unfiltered pages use database pagination. Requests involving search, category or saved IDs are filtered **before** pagination, with a short-lived cached full-archive scan for broad filters, and a targeted ID query for Saved. Beyond 20,000 archive rows requires an indexed database solution.
- `features/map` and `features/participation` keep their prior features. `components/navigation/Shell.tsx` displays four tabs.
- `app/notices/[id]/page.tsx` reads source-backed notices from Supabase and renders `features/records/RecordPageFrame.tsx` with `LiveRecordDetails`.
- `features/records/records.css` is loaded by the notice detail layout. The theme stays in `app/globals.css`.
- Shared read APIs and administrator writes are documented in DATA-API.md.

## Checks

`npm run check` runs formatting, unit tests, TypeScript, a Next.js production build, and HTTP smoke tests against a temporary local production server. The tests no longer expect deleted curated records or `/decisions/` detail pages. Automated category tests cover sorting, normalization, search combinations, and saved notice IDs.

Manual UI checks: Home contains only Supabase public notices; choose a category, reverse the date order, search and paginate; save an actual notice, switch to Saved and refresh; return from its detail; verify Map and Participate and check a narrow screen. The empty local notice test dataset is expected.

The API integration now reads shared raw notices and hash-matched AI summaries; source ingestion is manual and Realtime refreshes subscribers. See DATA-API.md.
