# William Calk's 1775 journal: house-style route map

Story: "William Calk's 1775 journal" – https://kyhistorydrive.com/#timeline/william-calks-1775-journal
Built 2026-10-10 by Story Studio with `make_map.py` + shared `../routemap.py` (same house style as the Warriors' Path map). Static final frame; reusable as a video asset. Batch 1 of the route-maps series.

## Files
| file | size | use |
|---|---|---|
| william-calks-1775-journal-route-map-master-3840.png | 3840x2160 | video master / library copy |
| william-calks-1775-journal-route-map.png / .webp | 1600x900 | site full size |
| william-calks-1775-journal-route-map-web.webp | 960x540, <200 KB | inline web |
| william-calks-1775-journal-route-map-390.png | 390x219 | phone legibility check |
| william-calks-1775-journal-route-map-dark.png / -dark.webp / -dark-390.png | 1600x1080 / 390 | map on the site's dark theme (tokens from src/styles.css) |
| make_map.py (+ ../routemap.py) | – | generator; re-run to rebuild every size |

Site file names per the SEO spec: `/content/maps/william-calks-1775-journal-route-map.{avif,webp,jpg}` (rename on import; JPEG fallback ≤1600 px).

## Era
March 13 – April 20, 1775 (journal continues at Boonesborough to May 2, 1775). Caption years: "1775".

## Based on a historical map?
No. Waypoints are placed from Calk's own dated entries (places he names: Rapidan, North Fork of James River, the Blue Ridge, Crow's Ferry, the head of Catawba, Pepper's Ferry, Fort Chiswell, Major Campbell's on the Holston, Daniel Smith's on the Clinch, Elk Garden, Briley's mill, Cove Creek, Powell Mountain, Martin's in Powell Valley, Indian Creek, Cumberland Gap, Cumberland River, Richland Creek, Laurel River, "the Brush," Rockcastle River, the Blue Lick, Otter Creek, Boonesborough). The Kentucky leg follows the researched line of Boone's Trace (1775). The Virginia leg follows the Great Wagon Road corridor through the Valley to Fort Chiswell. Pre-1775 maps (Fry-Jefferson 1751/55) don't show this road at a usable scale.

## One-sentence route (plain text)
William Calk walked from Prince William County, Virginia, by Rapidan and over the Blue Ridge, down the Valley to Crow's Ferry, Pepper's Ferry on the New River and Fort Chiswell, across the Clinch country to Martin's Station in Powell Valley, through Cumberland Gap on April 8, and along Boone's Trace by the Cumberland, Laurel and Rockcastle rivers to Boonesborough on April 20, 1775.

Distance (measured on the map line): about 490 miles; a 39-day trip including a five-day snowbound stop on the Clinch.

## Waypoints (journal dates) – WGS84, approximate
| # | date (1775) | stop in the journal | modern town / area | county, state | lat, lon | confidence |
|---|---|---|---|---|---|---|
| 1 | Mar 13 | sets out from Prince William | Manassas area (home site unknown) | Prince William Co., VA | 38.72, -77.48 | low (county only) |
| 2 | Mar 14 | Mr. Prize's at Rapidan | Rapidan | Culpeper/Orange cos., VA | 38.31, -78.06 | medium |
| 3 | Mar 15 | Mr. Car's on North Fork James River | Charlottesville area (Rivanna) | Albemarle Co., VA | ≈38.08, -78.45 | low |
| 4 | Mar 16–17 | Mr. Black's at the foot of the Blue Ridge; crosses the Ridge; James Loyl's | Crozet / Staunton area | Albemarle / Augusta cos., VA | ≈37.95, -78.9 | low |
| 5 | Mar 18–20 | William Anderson's at Crow's Ferry (James River) | Buchanan area | Botetourt Co., VA | ≈37.53, -79.68 | medium |
| 6 | Mar 20 | Wm. Adams's on the head of Catawba | Catawba valley | Roanoke/Botetourt cos., VA | ≈37.37, -80.10 | low |
| 7 | Mar 21 | Pepper's Ferry, New River | near Radford | Montgomery/Pulaski cos., VA | ≈37.17, -80.48 | medium |
| 8 | Mar 22 | Fort Chiswell | Fort Chiswell (I-77/I-81) | Wythe Co., VA | 36.94, -80.94 | high |
| 9 | Mar 23 | Major Campbell's on the Holston | Royal Oak / Marion | Smyth Co., VA | ≈36.83, -81.52 | medium |
| 10 | Mar 24 | Laurel Fork of Holston, "under a grait mountain" | north of Saltville | Smyth/Washington cos., VA | ≈36.92, -81.80 | low |
| 11 | Mar 25–30 | Daniel Smith's on the Clinch (snowbound) | Castlewood (Castle's Woods) | Russell Co., VA | ≈36.93, -82.28 | medium |
| 12 | Mar 31 | Briley's mill on the Clinch | Dungannon area | Scott Co., VA | ≈36.83, -82.45 | low |
| 13 | Apr 1–3 | Clinch River, Cove Creek, over Powell Mountain, Powell River | Duffield / Powell Valley | Scott & Lee cos., VA | ≈36.72, -82.6 to -83.08 | low |
| 14 | Apr 4 | Capt. Martin's in Powell Valley; overtakes Henderson | Martin's Station (Wilderness Road State Park, Ewing) | Lee Co., VA | 36.64, -83.40 | high |
| 15 | Apr 5–7 | Indian Creek camp | near Ewing / Cumberland Gap | Lee Co., VA | ≈36.62, -83.55 | medium |
| 16 | Apr 8 | crosses Cumberland Gap "about one oclock" | Cumberland Gap NHP | Bell Co., KY / Lee Co., VA / Claiborne Co., TN | 36.604, -83.674 | high |
| 17 | Apr 9–11 | Cumberland River (Cumberland Ford) | Pineville | Bell Co., KY | 36.76, -83.70 | high |
| 18 | Apr 11–12 | down the Cumberland ~10 mi; Richland Creek | Barbourville area | Knox Co., KY | ≈36.86, -83.88 | medium |
| 19 | Apr 13–14 | Laurel River | near Corbin / London | Laurel Co., KY | ≈37.01, -84.05 | medium |
| 20 | Apr 15 | "the Brush"; crosses Rockcastle River | near Livingston / Hazel Patch | Rockcastle/Laurel cos., KY | ≈37.30, -84.20 | medium |
| 21 | Apr 16–18 | up a creek (Roundstone) to the waters of the Kentucky; near the Blue Lick | Berea area | Rockcastle/Madison cos., KY | ≈37.5–37.6, -84.26 | medium |
| 22 | Apr 19 | where Boone's company was attacked (Twetty's Fort site); camp on Otter Creek | south of Richmond | Madison Co., KY | ≈37.68, -84.33 | medium |
| 23 | Apr 20 | Boonesborough ("Boons foart") about noon | Fort Boonesborough State Park | Madison Co., KY | 37.898, -84.265 | high |

## Uncertainty notes
- Labelled approximate throughout. Calk names houses, ferries and streams, not coordinates. Several private houses (Prize, Car, Black, Loyl, Anderson, Adams, Smith, Duncan, Briley) are placed from the stream or ferry he names and should be read as ±10–15 miles.
- Mar 24 – Apr 3 (leaving the wagon road to cross the mountains by Daniel Smith's on the Clinch to Powell Valley) is dashed and labelled conjectural.
- "North Fork James River" on Mar 15 probably means the Rivanna country. Others read it as the North (Maury) River, which would put Mar 15–17 farther southwest. Either way the line passes the same corridor.
- Boone's Trace in Kentucky follows modern Boone Trace research (Cumberland Ford, Flat Lick/Richland Creek, Laurel River, Hazel Patch, Rockcastle, Roundstone Creek, Boone Gap, Twetty's Fort, Otter Creek). The fine route between these points is approximate.
- State lines are modern. In 1775 this was all Virginia (Fincastle County west of the Blue Ridge).

## Suggested alt text (≤125 chars)
Map of William Calk's 1775 trek from Prince William County, Virginia, through Cumberland Gap to Boonesborough, Kentucky.

Suggested caption: "Route of William Calk's journey, March–April 1775. Approximate path, house map by Kentucky History Drive." Sources: Calk journal (KHS); Boone Trace research; NPS Cumberland Gap.

## Sources
1. William Calk, journal, 1775. Kentucky Historical Society, Calk Collection, transcript: https://www.kyhistory.com/digital/collection/Calk2/id/5/ ; ExploreKYHistory: https://explorekyhistory.ky.gov/files/show/1874
2. "Journal of William Calk, Kentucky Pioneer," ed., *Mississippi Valley Historical Review* 7 (1921): 363–377 (full text, as reproduced at http://johannfactotum.blogspot.com/2014/10/journal-of-william-calk-surveyor-of.html, checked against 1).
3. Robert F. Collins, *A History of the Daniel Boone National Forest 1770–1970*, USFS, 1975, ch. 10 (Henderson's party, Calk, April 8 crossing): https://npshistory.com/publications/usfs/region/8/daniel-boone/history/chap10.htm
4. Ellen Eslinger, ed., *Running Mad for Kentucky: Frontier Travel Accounts* (University Press of Kentucky, 2004), "William Calk, 1775."
5. Boone Trace 1775 Foundation / KHS Boone Trace research and markers (Cumberland Ford to Fort Boonesborough): https://www.boonetrace1775.com/
6. NPS, Cumberland Gap National Historical Park: https://www.nps.gov/cuga/
7. Base data: Natural Earth 10 m (public domain), https://www.naturalearthdata.com ; relief: AWS Terrain Tiles, https://registry.opendata.aws/terrain-tiles/
(Items 4–5 cited from bibliographic knowledge; not re-read online in this pass. The Boone Trace URL should be verified before publishing.)

## v2 design pass (2026-10-11, Critiquito fixes)
- **Phone art (new):** `william-calks-1775-journal-route-map-phone.png` / `.webp` (780x439, 2x for a 390 CSS-px slot). It's a Kentucky-focused crop with only these stops: Martin’s Station, Cumberland Gap, Cumberland River, Rockcastle River, Boonesborough. Labels are 118 px at 3840, which is 24 px at 780. Sub-labels, towns, river labels, the legend and the credits are dropped. `william-calks-1775-journal-route-map-390.png` is now made from the phone art. Dark-frame version: `william-calks-1775-journal-route-map-phone-dark.png`; `william-calks-1775-journal-route-map-dark-390.png` is made from that. Serve it with `<picture><source media="(max-width: 600px)" srcset="…-phone.webp">`.
- **Credits and scale:** the credit line and the "Statute Miles" scale bar now sit on a solid parchment strip at the bottom of the frame. All labels, the cartouche, the legend and the strip are drawn above the burned edge and vignette, and labels are kept out of the outer edge.
- **Line styles:** conjectural / approximate segments are now **red dots**. Branches and other routes are **lighter, muted-red dashes**. Approximate points are red rings with a parchment fill, so a line passing through one no longer overprints it.
- **Dark version:** `william-calks-1775-journal-route-map-dark.png/.webp` no longer has the frame heading or "Route map" line. The map's own cartouche is the only title. The caption under the map is kept at 1600 only; on the page, render it as HTML text.

## Legend (for the page HTML, under the phone art)
- solid red line: Calk’s route (approximate)
- red dotted line: conjectural segment
- red chevron: direction of travel
- dark dot: named place in the journal
- red ring: approximate location
- small open circle: modern town, for orientation
- fine brown dashes: modern state line
- Credit: Route after William Calk’s journal, 1775 (Kentucky Historical Society, Calk Collection); Boone Trace research (KHS, Boone Trace 1775); NPS Cumberland Gap. Base data Natural Earth / U.S. Census, public domain. Relief: AWS Terrain Tiles (SRTM / USGS). Map by KY History Drive, 2026. All positions approximate.
