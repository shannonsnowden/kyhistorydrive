# George Rogers Clark, Illinois Campaign 1778–79: house-style route map

Story: "George Rogers Clark" – https://kyhistorydrive.com/#timeline/george-rogers-clark
Built 2026-10-10 for Kentucky History Drive with `make_map.py` + shared `../routemap.py` (same house style as the Warriors' Path map). Static final frame; reusable as a video asset. Batch 1 of the route-maps series.

## Files
| file | size | use |
|---|---|---|
| george-rogers-clark-route-map-master-3840.png | 3840x2160 | video master / library copy |
| george-rogers-clark-route-map.png / .webp | 1600x900 | site full size |
| george-rogers-clark-route-map-web.webp | 960x540, <200 KB | inline web |
| george-rogers-clark-route-map-390.png | 390x219 | phone legibility check |
| george-rogers-clark-route-map-dark.png / -dark.webp / -dark-390.png | 1600x1080 / 390 | map on the site's dark theme (tokens from src/styles.css) |
| make_map.py (+ ../routemap.py) | – | generator; re-run to rebuild every size |

Site file names per the SEO spec: `/content/maps/george-rogers-clark-route-map.{avif,webp,jpg}` (rename on import; JPEG fallback ≤1600 px).

## Era
May 1778 – February 25, 1779 (Corn Island camp, Ohio voyage, capture of Kaskaskia and Cahokia, winter march, surrender of Fort Sackville). Caption years: "1778–1779".

## Based on a historical map?
No. The line is placed from Clark's own accounts (his 1779 letter to George Mason and his later Memoir) and Maj. Joseph Bowman's journal of the winter march, as edited by James (1912), with fixed points from NPS George Rogers Clark NHP, Fort Massac State Park and Illinois/Indiana markers. The Ohio leg follows the Natural Earth river line.

## One-sentence route (plain text)
George Rogers Clark's men left Corn Island at the Falls of the Ohio on June 24, 1778, rowed down the Ohio to the old French Fort Massac, marched about 120 miles overland to take Kaskaskia on the night of July 4, and sent Bowman to take Cahokia, while Father Gibault and Leonard Helm won over Vincennes. In February 1779 Clark marched about 180 miles from Kaskaskia through flooded country to retake Vincennes, where Hamilton surrendered Fort Sackville on February 25.

Distance (measured on the map line): about 300 miles by river to Fort Massac, about 90 miles in a straight-ish line overland (Clark's figure is ~120 miles), and about 145 straight-line miles for the winter march (usually given as ~180 miles walked).

## Waypoints – WGS84, approximate
| # | date | stop | modern town / area | county, state | lat, lon | confidence |
|---|---|---|---|---|---|---|
| 1 | May – June 24, 1778 | Corn Island camp, Falls of the Ohio; boats leave during the eclipse | Louisville waterfront (island quarried away) | Jefferson Co., KY | 38.27, -85.77 | high (site); island gone |
| 2 | ≈June 28 | Fort Massac (abandoned French fort); boats hidden | Fort Massac State Park, Metropolis | Massac Co., IL | 37.148, -88.707 | high |
| 3 | June 29 – July 4 | overland march NW across southern Illinois | Johnson–Williamson–Jackson–Randolph cos. | IL | ≈37.36–37.86, -88.9 to -89.66 | low |
| 4 | July 4, 1778 | Kaskaskia taken without a shot | old Kaskaskia (now cut off by the Mississippi; Kaskaskia Island) / Fort Kaskaskia SHS near Ellis Grove | Randolph Co., IL | ≈37.92, -89.91 | medium (town moved by river) |
| 5 | July 6, 1778 | Cahokia (Bowman's detachment) | Cahokia Heights | St. Clair Co., IL | 38.571, -90.190 | high |
| 6 | July 1778 | Vincennes declares for Virginia (Gibault & Helm) | Vincennes | Knox Co., IN | 38.679, -87.535 | high |
| 7 | Feb 6, 1779 | winter march leaves Kaskaskia | Kaskaskia | Randolph Co., IL | 37.92, -89.91 | medium |
| 8 | Feb 13–15 | Little Wabash crossings (forks flooded, ~5 miles of water) | near Clay City / Flora | Clay Co., IL | ≈38.62, -88.27 | low |
| 9 | Feb 17–22 | Embarras River and the drowned lands opposite Vincennes | near Lawrenceville / St. Francisville | Lawrence Co., IL | ≈38.60, -87.66 | low |
| 10 | Feb 23–25, 1779 | Vincennes, Fort Sackville surrendered by Hamilton | George Rogers Clark NHP | Knox Co., IN | 38.679, -87.535 | high |

## Uncertainty notes
- The Ohio leg is the river itself (certain); the hand-drawn smoothing is approximate.
- The 1778 overland leg follows the old Massac–Kaskaskia trace corridor. It is solid but approximate; the exact line (including the guide getting lost) is unknown.
- The 1779 winter march is dashed. Bowman's journal gives daily camps and river crossings but not exact positions. Crossings of the Little Wabash and Embarras are placed by modern river courses.
- Bowman's Cahokia detachment is a thin dashed branch. Helm and Gibault's July 1778 trip to Vincennes followed roughly the same trace as the winter march. It is noted in the Vincennes label instead of drawn twice.
- Rivers are modern. The Mississippi has since moved east and cut off old Kaskaskia, and Corn Island has been quarried away.
- The story text covers 1778–80 (Louisville's founding, Fort Nelson). This map covers only the Illinois campaign.

## Suggested alt text (≤125 chars)
Map of George Rogers Clark's 1778–79 Illinois Campaign from the Falls of the Ohio to Kaskaskia, Cahokia and Vincennes.

Suggested caption: "Route of George Rogers Clark's Illinois Campaign, 1778–1779. Approximate path, house map by Kentucky History Drive." Sources: Clark's memoir and Bowman's journal (James 1912); NPS.

## Sources
1. James Alton James, ed., *George Rogers Clark Papers, 1771–1781* (Illinois Historical Collections vol. 8, Springfield, 1912): Clark to George Mason, Nov. 19, 1779; Clark's Memoir; Bowman's journal (Jan. 29 – Mar. 20, 1779). Archive.org: https://archive.org/details/georgerogersclar00clar
2. National Park Service, George Rogers Clark National Historical Park, "The Illinois Campaign" / history pages: https://www.nps.gov/gero/learn/historyculture/index.htm
3. Illinois DNR, Fort Massac State Park; Fort Kaskaskia State Historic Site: https://dnr.illinois.gov/parks/park.fortmassac.html
4. Wikipedia, "George Rogers Clark" and "Illinois campaign" (story source; cross-checked dates): https://en.wikipedia.org/wiki/Illinois_campaign
5. Base data: Natural Earth 10 m (public domain); relief: AWS Terrain Tiles.
(Items 1–3 cited from bibliographic knowledge; URLs should be verified before publishing.)

## v2 design pass (2026-10-11, Critiquito fixes)
- **Phone art (new):** `george-rogers-clark-route-map-phone.png` / `.webp` (780x439, 2x for a 390 CSS-px slot). It's a Kentucky-focused crop with only these stops: Corn Island, Fort Massac, Kaskaskia, Cahokia, Vincennes. Labels are 118 px at 3840, which is 24 px at 780. Sub-labels, towns, river labels, the legend and the credits are dropped. `george-rogers-clark-route-map-390.png` is now made from the phone art. Dark-frame version: `george-rogers-clark-route-map-phone-dark.png`; `george-rogers-clark-route-map-dark-390.png` is made from that. Serve it with `<picture><source media="(max-width: 600px)" srcset="…-phone.webp">`.
- **Credits and scale:** the credit line and the "Statute Miles" scale bar now sit on a solid parchment strip at the bottom of the frame. All labels, the cartouche, the legend and the strip are drawn above the burned edge and vignette, and labels are kept out of the outer edge.
- **Line styles:** conjectural / approximate segments are now **red dots**. Branches and other routes are **lighter, muted-red dashes**. Approximate points are red rings with a parchment fill, so a line passing through one no longer overprints it.
- **Dark version:** `george-rogers-clark-route-map-dark.png/.webp` no longer has the frame heading or "Route map" line. The map's own cartouche is the only title. The caption under the map is kept at 1600 only; on the page, render it as HTML text.

## Legend (for the page HTML, under the phone art)
- solid red line: Clark’s route, 1778 (approximate on land)
- red dotted line: winter march, 1779 (approximate)
- light red dashes: Bowman to Cahokia, July 1778
- red chevron: direction of travel
- dark dot: fort / town on the route
- red ring: approximate point
- small open circle: modern town, for orientation
- fine brown dashes: modern state line
- Credit: Route after Clark’s memoir & Bowman’s journal (James, ed., 1912), NPS George Rogers Clark NHP, IL & IN historical markers. Base data Natural Earth / U.S. Census, public domain. Relief: AWS Terrain Tiles (SRTM / USGS). Rivers are modern courses; Kaskaskia’s 1778 site is now cut off by the Mississippi. Map by KY History Drive, 2026. All positions approximate.
