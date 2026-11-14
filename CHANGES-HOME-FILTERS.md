# Home / municipal notice browser update

Based on the user's uploaded `civic-hack-2026-clean-main (5).zip`.

## Changes

- Kept **Home**, removed the redundant **Decisions** tab, curated cards, all 14 hardcoded items, and the `/decisions/[id]` route.
- One search field + **Filters** toggle, with **Sort by** (Newest/Oldest) and **Category** dropdown (All, Transportation, Housing, Taxes & Budget, Infrastructure, Other). No duplicate topic chips.
- Search, sorting and category filtering now work together **before** paging the full Supabase notice archive; no filter is applied solely to the 12 cards already shown.
- Saved now bookmarks real Supabase notice IDs in this browser (storage key `yc-saved-notices`); previous static decision bookmarks are deliberately not imported.
- Kept Map, Participate and all real public-notice detail pages. Back links on notice detail pages return to Home.
- No database changes, no automatic source sync changes, and no files or credentials written to GitHub.

## Implementation note

The current Supabase feed has no category column. The server reads up to 20,000 notices to evaluate topic/title-derived categories and broader searches, with a brief 15-second in-process cache. The default unfiltered listing still uses native database pagination. If the dataset becomes large, replace this fallback with a normalized indexed category and database text-search columns.

## Validation

- 68 Node.js unit tests passed, including 5 new category/search/sort/bookmark tests.
- 31 TS/TSX files parsed with no TypeScript **syntax** diagnostics.
- `npm ci` could not complete in this isolated environment (registry DNS timeout); therefore full type checking, production build, browser QA and Prettier checks are **not claimed** as passed. The original package lock is retained; run `npm ci`, `npm run check`, then `npm run dev` on a connected development machine.
