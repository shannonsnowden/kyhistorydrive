# Warriors' Path (Athiamiowee) – house-style static map

Story: "Athiamiowee: the Warriors' Path through Kentucky" – https://kyhistorydrive.com/#timeline/athiamiowee-the-warriors-path-through-kentucky
Built 2026-10-10 by Story Studio with `make_warriors_path_map.py` (reuses `/workspace/video-style/mary-ingles/src/mapseq.py`: parchment, Natural Earth rivers, AWS terrarium relief, burned edges, vignette, hand-lettered labels, red route). Static final frame, no animation. `make_presentation.py` builds the phone preview and the dark-site variant.

## Files
| file | size | use |
|---|---|---|
| warriors-path-map-master-3840.png | 3840x2160 | video master / library copy |
| warriors-path-map.png / .webp | 1600x900 | site full size |
| warriors-path-map-web.webp | 960x540, ~109 KB | inline web |
| warriors-path-map-390.png | 390x219 | phone legibility check |
| warriors-path-map-dark.png / .webp, -dark-390.png | 1600x1080 / 390 | map on the site's dark background (#101812 bg, #1a241c panel, #2e4034 line, #f6edd8 focus frame, #e8d5a8 heading, #c9893a accent, #a8b59c caption, from src/styles.css) |
| kygeonet-warriors-path.json | – | route geometry used (KYGeoNet layer 1, 'Warriors Path*' features) |

Site file names per route-map SEO spec: `/content/maps/athiamiowee-the-warriors-path-through-kentucky-route-map.{avif,webp,jpg}` (rename on import; JPEG fallback ≤1600 px).

## Era of use
Used by Native nations long before Europeans arrived (an old game trail); first recorded by a European in 1674 (Gabriel Arthur); named the "Warriors' Path" by English speakers by the 1750s; used by Walker (1750), Gist (1751), Finley and Boone (1769); absorbed into pioneer roads in the 1770s–80s. Caption years: "before 1674 to the 1770s".

## Based on a historical map?
Partly. The route is shown on John Filson's 1784 map of Kentucke, but Filson (and Pownall 1776) draw it as a near-straight schematic line well off its real corridor, so the line here is NOT traced from Filson. It follows the modern GIS reconstruction in KYGeoNet "Ky Frontier Trails" (University of Kentucky / KY Division of Geographic Information), which plots it from confirmed landmarks (gaps, fords, licks, place names like War Fork, Station Camp Creek) and terrain, checked against the KHS marker text, Kincaid and the USFS/NPS histories. Filson 1784 is cited as the period map that records the path.

## One-sentence route (plain text)
The Warriors' Path ran from the Ohio River opposite the mouth of the Scioto (Lower Shawneetown, near present South Portsmouth) south past Eskippakithiki in Clark County, across the Red and Kentucky rivers near Irvine, along War Fork and Goose Creek to Flat Lick, over the Cumberland River at Pineville, and through Cumberland Gap toward the Cherokee Overhill towns on the Little Tennessee River.

Distance (measured on the map line): about 220 miles from the Ohio to Cumberland Gap, plus roughly 80–90 more (conjectural) to the Overhill towns.

## Waypoints (north to south) – coordinates WGS84, all approximate
| # | stop | modern town / area | county, state | lat, lon | confidence |
|---|---|---|---|---|---|
| 1 | Lower Shawneetown (Ohio crossing, mouth of the Scioto) | South Portsmouth / Fullerton (opposite Portsmouth OH) | Greenup Co., KY (& Scioto Co., OH) | 38.677, -83.107 | high (town site), KYGeoNet point |
| 2 | Scioto prong via Slate Creek country | near Olive Hill / Mount Sterling area | Carter–Bath–Montgomery cos., KY | 38.137, -83.566 (bend) | low / conjectural |
| 3 | Eskippakithiki (Indian Old Fields) | Indian Fields, ~10 mi E of Winchester | Clark Co., KY | 37.946, -84.000 | high |
| 4 | Red River crossing (near Kentucky River junction) | near Clay City / Lulbegrud Creek | Clark–Powell–Estill cos., KY | ~37.84, -84.02 | medium |
| 5 | Kentucky River ford (Station Camp Creek) | Irvine | Estill Co., KY | ~37.69, -83.97 | medium |
| 6 | War Fork / Sand Gap (KHS marker #697) | Gray Hawk (marker on US 421) | Jackson Co., KY | ~37.40, -83.94 | high (marker) |
| 7 | Goose Creek | Manchester | Clay Co., KY | ~37.15, -83.76 | high/probable |
| 8 | Flat Lick | Flat Lick | Knox Co., KY | 36.838, -83.771 | high |
| 9 | Cumberland Ford | Pineville | Bell Co., KY | 36.749, -83.693 | high |
| 10 | Cumberland Gap | Middlesboro KY / Cumberland Gap TN | Bell Co., KY; Claiborne Co., TN; Lee Co., VA | 36.604, -83.674 | high |
| 11 | Overhill Cherokee towns (Chota) | near Vonore, Little Tennessee River (Tellico Lake) | Monroe Co., TN | 35.53, -84.13 | towns high; path south of the Gap conjectural |
Branch (KHS/story text): from Eskippakithiki NE across the Licking near Upper Blue Licks (38.332, -83.857; Fleming/Nicholas cos.) to the Ohio at Cabin Creek (38.62, -83.67; Mason/Lewis cos.), with a Maysville prong. Drawn as thin dashed red.

## Uncertainty notes
- Labelled "approximate route" throughout; no trail survives as a continuous mapped line. KYGeoNet rates Cumberland Gap–Eskippakithiki mostly "High/Probable" (one Irvine–Red River link "Low/Conjectural"); all northern prongs are "Low/Conjectural".
- Two northern termini are documented: the Scioto mouth (USFS history, Kincaid, KYGeoNet, Myer) and Cabin Creek via Blue Licks (KHS marker #697 text / ExploreKYHistory, used in our story text). The map shows the Scioto prong as the main line and Blue Licks/Cabin Creek as a dashed branch, so it agrees with the story.
- South of Cumberland Gap the line is hand-placed (Powell Valley, Holston crossing near Knoxville, Little Tennessee) and dashed; Myer 1928 shows several alternative Cherokee connections.
- Spec coordinate for Eskippakithiki (37.93, -84.07) was replaced by the KYGeoNet "Indian Fields" point (37.946, -84.000), which matches Beckner's location of the town at Indian Old Fields.
- Red River and Little Tennessee are not in Natural Earth 10 m; hand-traced schematically.
- State lines are modern (Natural Earth admin-1); in 1750s–70s this was Virginia's claimed Kentucky country.

## Suggested alt text (≤125 chars)
Map of the Warriors' Path from the Ohio River at the Scioto south past Eskippakithiki to Cumberland Gap and Cherokee towns.

Suggested caption: "Route of the Warriors' Path (Athiamiowee), before 1674 to the 1770s. Approximate path, house map by Kentucky History Drive." Sources: Filson 1784; KHS marker #697; KYGeoNet Ky Frontier Trails; NPS.

## Sources
1. John Filson, *This Map of Kentucke, Drawn from Actual Observations*, Philadelphia, 1784. Library of Congress, Geography & Map Division: https://www.loc.gov/item/75693147/ ; KHS copy: https://explorekyhistory.ky.gov/files/show/2793
2. Kentucky Historical Society, Historical Marker #697 "Warriors' Path" (US 421, Gray Hawk, Jackson Co.): https://history.ky.gov/markers/warriors-path ; ExploreKYHistory: https://explorekyhistory.ky.gov/items/show/602
3. KYGeoNet / University of Kentucky & KY Division of Geographic Information, "Ky Frontier Trails" map service (Warriors Path features, source "Kinkead description; USGS Topo 1:24K"): https://kygisserver.ky.gov/arcgis/rest/services/WGS84WM_Services/Ky_Frontier_Trails_WGS84WM/MapServer
4. "Mapping Kentucky's frontier trails through geographical information and cartographic applications" (GIS reconstruction; notes Filson/Pownall misplace the path): https://kygenweb.net/carter/the_original_peoples/Mapping_Kentucky.htm
5. Robert F. Collins, *A History of the Daniel Boone National Forest 1770–1970*, USFS, 1975, ch. 21 (route via Flat Lick, Goose Creek, Sand Gap, Station Camp Creek, Irvine, Red River, Lulbegrud Creek, Indian Old Fields, Scioto): https://npshistory.com/publications/usfs/region/8/daniel-boone/history/chap21.htm
6. National Park Service, Cumberland Gap NHP, "Warrior's Path": https://www.nps.gov/cuga/learn/historyculture/warriors-path.htm
7. William E. Myer, "Indian Trails of the Southeast," *42nd Annual Report of the Bureau of American Ethnology* (1924–25), Washington, 1928, pp. 727–857 (Trail no. 1 / Warriors' Path, plate 15).
8. Lucien Beckner, "Eskippakithiki: The Last Indian Town in Kentucky," *Filson Club History Quarterly* 6 (1932): 355–382.
9. John E. Kleber, ed., *The Kentucky Encyclopedia* (University Press of Kentucky, 1992), "Warriors' Path."
10. Base data: Natural Earth 10 m rivers and admin-1 states (public domain), https://www.naturalearthdata.com ; relief: AWS Terrain Tiles (SRTM/USGS/ETOPO), https://registry.opendata.aws/terrain-tiles/
(Items 7–9 cited from bibliographic records; not re-read online in this pass.)

## v2 design pass (2026-10-11, Critiquito fixes)
- **Phone art (new):** `warriors-path-map-phone.png` / `.webp` (780x439, 2x for a 390 CSS-px slot). It's a Kentucky-focused crop with only these stops: Lower Shawneetown, Eskippakithiki, Kentucky R. ford, War Fork, Cumberland Ford, Cumberland Gap. Labels are 118 px at 3840, which is 24 px at 780. Sub-labels, towns, river labels, the legend and the credits are dropped. `warriors-path-map-390.png` is now made from the phone art. Dark-frame version: `warriors-path-map-phone-dark.png`; `warriors-path-map-dark-390.png` is made from that. Serve it with `<picture><source media="(max-width: 600px)" srcset="…-phone.webp">`.
- **Credits and scale:** the credit line and the "Statute Miles" scale bar now sit on a solid parchment strip at the bottom of the frame. All labels, the cartouche, the legend and the strip are drawn above the burned edge and vignette, and labels are kept out of the outer edge.
- **Line styles:** conjectural / approximate segments are now **red dots**. Branches and other routes are **lighter, muted-red dashes**. Approximate points are red rings with a parchment fill, so a line passing through one no longer overprints it.
- **Dark version:** `warriors-path-map-dark.png/.webp` no longer has the frame heading or "Route map" line. The map's own cartouche is the only title. The caption under the map is kept at 1600 only; on the page, render it as HTML text.

## Legend (for the page HTML, under the phone art)
- solid red line: Warriors’ Path (approx. route)
- red dotted line: conjectural segment
- light red dashes: branch prongs to the Ohio
- dark dot: town / key landmark on the path
- red ring: approximate point
- small open circle: modern town, for orientation
- fine brown dashes: modern state line
- Credit: Route after Filson 1784, Myer 1928, KHS markers; trail GIS: KYGeoNet Ky Frontier Trails (UK). Base data Natural Earth / U.S. Census, public domain. Relief: AWS Terrain Tiles (SRTM / USGS). Map by KY History Drive, 2026. All positions approximate.
