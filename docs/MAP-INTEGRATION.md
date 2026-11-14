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

## 地址图钉与新下载版本

放大时，已知街道坐标由 Leaflet 聚合自动展开；只有区域名称的公告仍显示为区域位置，不伪造街道坐标。自动街道匹配需要本机 `.env.local` 中的 `GEOAPIFY_API_KEY`，下载 GitHub ZIP 不包含该密钥。保留原有本机配置，修改后重启 `npm run dev`。密钥只在服务端使用，不提交 GitHub。

定位按当前选中/放大的区域优先处理，每批数量有上限；单条请求失败不会阻止本批其他公告。已验证的定位结果会存入本机 `data/.street-geocodes.json`（Git 忽略），新浏览器可以直接读取，不再仅依赖浏览器 localStorage。缓存按原始街道地址匹配，有效期 14 天；原地址变化后不再使用旧位置。缓存不包含定位密钥，不会改写官方原始坐标。部署在其他电脑或无持久磁盘的服务器时，需要分别保留其定位配置与缓存。
