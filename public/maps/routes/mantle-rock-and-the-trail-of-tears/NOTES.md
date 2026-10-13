# Mantle Rock and the Trail of Tears, 1838–39: house-style route map

Story: "Mantle Rock and the Trail of Tears, 1838–39" – https://kyhistorydrive.com/#timeline/mantle-rock-and-the-trail-of-tears
Built 2026-10-10 for Kentucky History Drive with `make_map.py` + shared `../routemap.py` (generalised from the Warriors' Path map: parchment, hachured hillshade, burned edges, vignette, Kalam hand lettering, red route, cartouche, legend, scale bar, compass, credit line, modern state lines). Static final frame; reusable as a video asset. Batch 1 of the route-maps series.

## Files
| file | size | use |
|---|---|---|
| mantle-rock-and-the-trail-of-tears-route-map-master-3840.png | 3840x2160 | video master / library copy |
| mantle-rock-and-the-trail-of-tears-route-map.png / .webp | 1600x900 | site full size |
| mantle-rock-and-the-trail-of-tears-route-map-web.webp | 960x540, <200 KB | inline web |
| mantle-rock-and-the-trail-of-tears-route-map-390.png | 390x219 | phone legibility check |
| …-dark.png / -dark.webp / -dark-390.png | 1600x1080 / 390 | map on the site's dark theme (#101812 bg, #1a241c panel, #2e4034 line, #f6edd8 focus frame, #e8d5a8 heading, #c9893a accent, #a8b59c caption; src/styles.css) |
| trte-nps.geojson, nps-routes-clip.json | – | NPS route geometry used (raw query + chained/clipped lines) |

Site file names per the SEO spec: `/content/maps/mantle-rock-and-the-trail-of-tears-route-map.{avif,webp,jpg}` (rename on import; JPEG fallback ≤1600 px).

## Era
Winter 1838–39 (the Northern Route detachments crossed Kentucky from roughly late October 1838 through January 1839; the Ohio was iced over for weeks around late December–January). Caption years: "1838–1839".

## Based on a historical map?
No. The line is the National Park Service's designated alignment for the Trail of Tears National Historic Trail (Northern Route), digitised at 1:100,000 from the trail's Comprehensive Management Plan maps. NPS itself notes the designated alignment "does not always coincide with historic trail trace." Waypoints were checked against the NPS Mantle Rock article, KHS markers and the 2025 cultural-resources letter report for Livingston County (US 41 → KY 91 → KY 133 / Salem–Golconda Road corridor).

## One-sentence route (plain text)
On the Northern Route of the Trail of Tears, Cherokee detachments entered Kentucky on the Port Royal Road in Todd County, camped at Hopkinsville and Princeton, followed the Salem–Golconda Road through Salem past Mantle Rock, and crossed the Ohio at Berry's Ferry to Golconda, Illinois, before heading west to the Mississippi.

Distance (measured on the map line): about 120 miles across Kentucky from the Tennessee line to Berry's Ferry, plus about 130 more across southern Illinois to the Mississippi crossing.

## Waypoints (in order of travel) – WGS84, approximate
| # | stop | modern town / area | county, state | lat, lon | confidence |
|---|---|---|---|---|---|
| 1 | Enters Kentucky on the Port Royal Road (Gray's Inn camp) | near Guthrie | Todd Co., KY | 36.64, -87.17 | medium (corridor high; camp point approx.) |
| 2 | Hopkinsville camp, rations; burials of Chiefs Whitepath and Fly Smith (Trail of Tears Commemorative Park) | Hopkinsville | Christian Co., KY | 36.857, -87.493 | high |
| 3 | Big Spring camp | Princeton | Caldwell Co., KY | 37.109, -87.882 | high |
| 4 | Salem (Salem–Golconda Road begins) | Salem | Livingston Co., KY | 37.264, -88.243 | high |
| 5 | Mantle Rock (winter camps strung along the road) | near Joy, off KY 133 | Livingston Co., KY | 37.360, -88.432 | high (site); camps spread for miles |
| 6 | Berry's Ferry, Ohio River crossing | opposite Golconda, IL (near Rondeau Island) | Livingston Co., KY / Pope Co., IL | 37.372, -88.476 | high |
| 7 | Mississippi crossing (Green's / Willard's ferries area) | near Cape Girardeau, MO | Union/Alexander Co., IL – Cape Girardeau Co., MO | ≈37.4, -89.47 | medium |

## Uncertainty notes
- The whole route is labelled approximate. The NPS line is a planning alignment, not a surveyed trace; individual detachments varied by miles and camps were spread out.
- The request named a "northern/Benge-Drane route through Hopkinsville and Princeton." The NPS data names this alignment simply the **Northern Route** (used by most detachments, including Peter Hildebrand's ~1,766 people who camped at Mantle Rock). The **Benge Route** is a separate alignment that crossed far-western Kentucky (Jackson Purchase) toward the Mississippi; it is drawn here as a thin dashed red line for context only. I found no NPS segment called "Drane" through Hopkinsville, so the map does not use that name. Please confirm the label before publishing.
- The KHS marker says the Cherokee sheltered under the arch and many died there; NPS says too many people to camp under it, camps were along the road, and there is no evidence of burials at Mantle Rock. The map labels "camps along the road," matching NPS and our story text.
- The NPS query was clipped at 90° W and 36.36° N; the line starts just north of Nashville.
- Rivers are modern Natural Earth courses (Kentucky Lake/Lake Barkley reservoirs did not exist in 1838; shown only as river lines).

## Suggested alt text (≤125 chars)
Map of the Trail of Tears Northern Route across Kentucky via Hopkinsville, Princeton and Mantle Rock to the Ohio at Golconda.

Suggested caption: "Route of the Cherokee removal's Northern Route, 1838–1839. Approximate path, house map by Kentucky History Drive." Sources: NPS Trail of Tears NHT GIS; KHS marker #1675.

## Sources
1. National Park Service, Trail of Tears National Historic Trail, designated alignment feature service TRTE_NHT (layer 0, "Northern Route", "Benge Route"), updated 3/31/2022: https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/TRTE_NHT/FeatureServer/0 ; dataset record: https://irmadev.nps.gov/DataStore/Reference/Profile/1048335
2. NPS, "Mantle Rock Preserve and the Trail of Tears": https://www.nps.gov/articles/000/mantle-rock-preserve-and-the-trail-of-tears.htm
3. NPS, Trail of Tears NHT maps: https://www.nps.gov/trte/planyourvisit/maps.htm
4. Kentucky Historical Society, Marker #1675 "Mantle Rock": https://history.ky.gov/markers/mantle-rock-12-mile
5. The Nature Conservancy, Mantle Rock Preserve: https://www.nature.org/en-us/get-involved/how-to-help/places-we-protect/mantle-rock-preserve/
6. Trail of Tears letter report, Mantle Rock Solar Project (KY PSC case 2024-00050, App. O, 2025), route summary citing Thomason & Parker 2003 and NPS 1992: https://psc.ky.gov/pscecf/2024-00050/tosterloh%40sturgillturner.com/08252025071143/2o_Appendix_O_Trail_of_Tears_Letter.pdf
7. NPS, *Comprehensive Management and Use Plan, Trail of Tears National Historic Trail* (1992) (cited via 1 and 6; not re-read).
8. Base data: Natural Earth 10 m rivers and admin-1 states (public domain), https://www.naturalearthdata.com ; relief: AWS Terrain Tiles (SRTM/USGS), https://registry.opendata.aws/terrain-tiles/

## v2 design pass (2026-10-11, Critiquito fixes)
- **Phone art (new):** `mantle-rock-and-the-trail-of-tears-route-map-phone.png` / `.webp` (780x439, 2x for a 390 CSS-px slot). It's a Kentucky-focused crop with only these stops: Enters KY, Hopkinsville, Princeton, Mantle Rock, Ferry to Golconda. Labels are 118 px at 3840, which is 24 px at 780. Sub-labels, towns, river labels, the legend and the credits are dropped. `mantle-rock-and-the-trail-of-tears-route-map-390.png` is now made from the phone art. Dark-frame version: `mantle-rock-and-the-trail-of-tears-route-map-phone-dark.png`; `mantle-rock-and-the-trail-of-tears-route-map-dark-390.png` is made from that. Serve it with `<picture><source media="(max-width: 600px)" srcset="…-phone.webp">`.
- **Credits and scale:** the credit line and the "Statute Miles" scale bar now sit on a solid parchment strip at the bottom of the frame. All labels, the cartouche, the legend and the strip are drawn above the burned edge and vignette, and labels are kept out of the outer edge.
- **Line styles:** conjectural / approximate segments are now **red dots**. Branches and other routes are **lighter, muted-red dashes**. Approximate points are red rings with a parchment fill, so a line passing through one no longer overprints it.
- **Dark version:** `mantle-rock-and-the-trail-of-tears-route-map-dark.png/.webp` no longer has the frame heading or "Route map" line. The map's own cartouche is the only title. The caption under the map is kept at 1600 only; on the page, render it as HTML text.

## Legend (for the page HTML, under the phone art)
- solid red line: Northern Route (NPS designated, approximate)
- light red dashes: Benge Route (another detachment)
- red chevron: direction of travel
- dark dot: camp / town on the route
- red ring: approximate point
- small open circle: modern town, for orientation
- fine brown dashes: modern state line
- Credit: Route: NPS Trail of Tears National Historic Trail GIS (designated alignment, 1:100,000); KHS markers incl. #1675 Mantle Rock. Base data Natural Earth / U.S. Census, public domain. Relief: AWS Terrain Tiles (SRTM / USGS). Rivers are modern courses. Map by KY History Drive, 2026. All positions approximate.
