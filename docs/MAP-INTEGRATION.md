# Map integration

Imported from the local `Toronto_Civic_Map` implementation, with map-specific files kept in `features/map/`, `lib/map-*.mjs`, and `app/api/map/`. Other pages, database credentials, source data and the friend's project configuration were not copied.

## Behavior

- Map pins cluster as you zoom; clicking a marker selects a notice, and selecting a list item focuses the map.
- The sidebar follows the current visible bounds and supports area and text filters.
- `/api/map/notices` reads the shared database server-side in batches and returns a compact map dataset. The browser makes one feed request per refresh rather than downloading dozens of archive pages.
- Blue pins use source coordinates; teal pins use validated street matches; amber pins are approximate district locations. Unknown or ambiguous locations stay unplaced.
- Original notice details remain linked by ID. No database migration is required for the map.

## Optional geocoding

Existing coordinates and broad district pins work without a geocoding key. To enable address matching, the server administrator can set `GEOAPIFY_API_KEY` in the ignored `.env.local` and restart the server. After explicit owner approval, the existing provider key was enabled only in the ignored local environment; no key is included in Git. Matching can consume provider quota; the current queue/cache is per Node process, so shared limits are needed before using multiple workers at scale.

Map assets use pinned Leaflet 1.9.4 and MarkerCluster 1.5.3 from jsDelivr; basemap tiles use OpenStreetMap. Internet access to these services is required. Attribution remains displayed. Geocoding requests are restricted to addresses belonging to existing notices, and keys stay on the server.

## Validation

`npm run test:map` checks district recognition, coordinate bounds, unknown locations, source-vs-geocoded locations, house-number/street validation and viewport deduplication. `npm run check` includes these tests, existing checks and map API smoke checks. Browser-only interactions still require a manual check of zoom, marker clusters, list selection, resize and mobile layout.

Live verification: the map feed returned 2,981 records; Geoapify matched the two source street addresses of notice 8002. The 12 map tests and all existing checks passed. Browser automation was unavailable, so zoom, clustering and selection still need manual browser acceptance.
