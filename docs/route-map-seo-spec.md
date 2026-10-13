SEO & AEO Desk spec for route maps (2026-10-10):
1. File: /content/maps/<story-slug>-route-map.{avif,webp,jpg}, lowercase hyphens, no dates/versions.
2. <figure><picture> AVIF+WebP sources, JPEG fallback <=1600px, width/height, loading=lazy unless first image; story photo stays LCP; visible <figcaption>.
3. Alt: one sentence <=125 chars describing the route; no "image of", no keyword stuffing.
4. Caption: "Route of <name>, <years>. Approximate path, house map by Kentucky History Drive." + sources line if based on a historical map; say approximate.
5. JSON-LD: ImageObject @id canonical#route-map (contentUrl JPEG, name "<Story> route map", caption, width, height, creator/copyrightHolder -> Organization @id, creditText "Kentucky History Drive", license /about/#license, acquireLicensePage). Article image = [storyPhoto, routeMap]; Place gets "hasMap": {"@id": canonical#route-map}. No separate schema.org Map.
6. og:image stays story photo.
7. Optional: image sitemap <image:image> under story URL.
8. One plain sentence near the map naming start, end, main waypoints.

AI Search Visibility additions (2026-10-10):
- Prerendered text: 1-2 sentence answer + ordered waypoint list with modern towns/counties (content from the art desk / KY Website Editor).
- Dates, distance, users as short sentences; sources section (KHS marker numbers, NPS).
- JSON-LD ItemList/Place of waypoints with geo.
- Title/H1 matching queries, e.g. "Warriors' Path in Kentucky: Route Map and Stops"; downloadable GeoJSON/KML link.
- Link routes from homepage and a /routes index; cross-link markers and stories along the route. (Homepage already links all stories since #193.)
