# Thomas Walker and Cumberland Gap, 1750: house-style route map

Story: "Thomas Walker and Cumberland Gap" – https://kyhistorydrive.com/#timeline/thomas-walker-and-cumberland-gap
Built 2026-10-10 for Kentucky History Drive with `make_map.py` + shared `../routemap.py` (same house style as the Warriors' Path map). Static final frame; reusable as a video asset. Batch 1 of the route-maps series.

## Files
| file | size | use |
|---|---|---|
| thomas-walker-and-cumberland-gap-route-map-master-3840.png | 3840x2160 | video master / library copy |
| thomas-walker-and-cumberland-gap-route-map.png / .webp | 1600x900 | site full size |
| thomas-walker-and-cumberland-gap-route-map-web.webp | 960x540, <200 KB | inline web |
| thomas-walker-and-cumberland-gap-route-map-390.png | 390x219 | phone legibility check |
| thomas-walker-and-cumberland-gap-route-map-dark.png / -dark.webp / -dark-390.png | 1600x1080 / 390 | map on the site's dark theme (tokens from src/styles.css) |
| make_map.py (+ ../routemap.py) | – | generator; re-run to rebuild every size |

Site file names per the SEO spec: `/content/maps/thomas-walker-and-cumberland-gap-route-map.{avif,webp,jpg}` (rename on import; JPEG fallback ≤1600 px).

## Era
March 6 – July 13, 1750 (Loyal Land Company exploring expedition). Caption years: "1750".

## Based on a historical map?
No. The outbound line is placed from Walker's journal (named rivers, gaps and settlers, plus dated camps) as interpreted by its editors (Rives 1888; Johnston 1898). Walker's Cave Gap and Cumberland River appear on the Fry–Jefferson map of Virginia (1751/55), which used his information, but that map is too schematic to trace. The return loop is reconstructed from secondary studies (Summers; Filson Club) and is dashed.

## One-sentence route (plain text)
Dr. Thomas Walker left Castle Hill in Albemarle County on March 6, 1750, crossed the Blue Ridge and the New, Holston and Clinch rivers, went through Cave Gap (Cumberland Gap) on April 13, named the Cumberland River, and raised a cabin near present Barbourville. He then looped north on the Warriors' Path toward the Red River, east past Paintsville to the Levisa Fork ("Louisa"), over to the Tug Fork and the New and Greenbrier rivers, and home by Hot Springs and Staunton on July 13.

Distance (measured on the map line): about 350 miles out to the cabin and 400 back, roughly 750 miles in four months.

## Waypoints – WGS84, approximate
| # | date (1750) | stop | modern town / area | county, state | lat, lon | confidence |
|---|---|---|---|---|---|---|
| 1 | Mar 6 | Castle Hill (Walker's home) | near Cismont / Keswick | Albemarle Co., VA | 38.08, -78.24 | high |
| 2 | Mar 7–9 | Col. Fry's; Thomas Joplin's on Rockfish River; John Harvie's | Rockfish valley | Albemarle/Nelson cos., VA | ≈37.8, -78.75 to -78.97 | low |
| 3 | mid-Mar | crosses the Fluvanna (upper James); "easy crossing" of the Blue Ridge; follows the Staunton (Roanoke) River | Lynchburg to Roanoke corridor | Bedford/Roanoke cos., VA | ≈37.3–37.5, -79.2 to -79.95 | low |
| 4 | mid-Mar | New (Wood's) River | near Radford / Ingles Ferry | Montgomery/Pulaski cos., VA | ≈37.13, -80.55 | medium |
| 5 | late Mar | Reed Creek; Holston River at Stalnaker's (farthest settler) | Chilhowie area | Wythe/Smyth cos., VA | ≈36.80, -81.68 | medium |
| 6 | early Apr | Clinch River; Powell River & valley | Clinchport / Powell Valley | Scott/Lee cos., VA | ≈36.62–36.67, -82.6 to -83.1 | low |
| 7 | Apr 13 | Cave Gap: "a plain Indian road," spring from a cave | Cumberland Gap NHP | Bell Co., KY / Lee Co., VA / Claiborne Co., TN | 36.604, -83.674 | high |
| 8 | Apr 17 | Cumberland River named (Cumberland Ford) | Pineville | Bell Co., KY | 36.76, -83.70 | medium |
| 9 | Apr 23–25 | crosses at "Swan's Pond," raises cabin | Dr. Thomas Walker State Historic Site, near Barbourville | Knox Co., KY | 36.817, -83.948 | high (traditional site) |
| 10 | May | Flat Lick, then north on the Warriors' Path toward the Red River | Flat Lick → Irvine area | Knox → Estill/Powell cos., KY | ≈36.84 → 37.70, -83.8 | low |
| 11 | late May | east by an old trail past Hazel Green and Salyersville to Paint Lick | Hazel Green, Salyersville, Paintsville | Wolfe, Magoffin, Johnson cos., KY | ≈37.8, -83.42 to -82.81 | low |
| 12 | June 7 | names the "Louisa" (Levisa Fork of the Big Sandy) | Levisa Fork below Paintsville | Johnson/Floyd cos., KY | ≈37.68, -82.62 | low–medium |
| 13 | mid–late June | over to the Tug Fork; old Big Sandy trail east | Williamson area → Mercer/Summers cos. | Pike Co., KY / Mingo, Mercer cos., WV | ≈37.5, -82.15 to -81.15 | low |
| 14 | late June | New River near the mouth of the Greenbrier | Hinton | Summers Co., WV | 37.67, -80.89 | medium |
| 15 | early July | up the Greenbrier; crosses the Allegheny divide July 8 | Ronceverte → Allegheny Mtn. | Greenbrier Co., WV / Alleghany Co., VA | ≈37.8, -80.45 to -80.05 | low |
| 16 | July 9 | Hot Springs | Hot Springs | Bath Co., VA | 38.00, -79.83 | medium |
| 17 | July 11 | Augusta Court House | Staunton | Augusta Co., VA | 38.15, -79.07 | high |
| 18 | July 13 | over Rockfish Gap to Castle Hill | Afton → Keswick | Nelson/Albemarle cos., VA | 38.03, -78.86 → 38.08, -78.24 | high (end points) |

## Uncertainty notes
- The outbound route is solid but approximate. Settler houses and river crossings are placed to ±10–15 miles.
- The return loop (May–July) is dashed and labelled conjectural. Secondary accounts disagree on its course. One reading has the party coming back through Wise, Dickenson, Buchanan and Tazewell counties, VA, before Mercer and Summers counties, WV. The map follows the more widely cited Hazel Green–Paintsville–Levisa–Tug–New–Greenbrier reading.
- After building the cabin, Walker and two men also made a short ~35-mile probe northwest. It isn't drawn.
- Some editors argue Walker's "Louisa" was the Kentucky River, not the Levisa Fork. The map follows Summers (Levisa) and flags it here.
- Walker's arrival is variously given as July 13 or 16. The journal's July 13 is used here.
- State lines are modern. In 1750 all of this was claimed as Augusta County, Virginia.

## Suggested alt text (≤125 chars)
Map of Thomas Walker's 1750 route from Castle Hill, Virginia, through Cumberland Gap to his cabin near Barbourville and back.

Suggested caption: "Route of Dr. Thomas Walker's expedition, March–July 1750. Approximate path, house map by Kentucky History Drive." Sources: Walker's journal (Rives 1888; Johnston 1898).

## Sources
1. Thomas Walker, *Journal of an Exploration in the Spring of the Year 1750*, ed. William Cabell Rives (Boston: Little, Brown, 1888); text with notes at Haywood County TNGenWeb: https://tngenweb.org/haywood/doctor-thomas-walkers-journal/
2. J. Stoddard Johnston, *First Explorations of Kentucky: Doctor Thomas Walker's Journal … and Colonel Christopher Gist's Journal* (Filson Club Publications 13, Louisville, 1898).
3. Lewis Preston Summers, *Annals of Southwest Virginia, 1769–1800* (1929), notes on Walker's route (via 1).
4. McLeod Alexander Canady, "A Man for All Regions: Dr. Thomas Walker of Castle Hill," *Filson Club History Quarterly* 71:2 (1997): https://filsonhistorical.org/wp-content/uploads/publicationpdfs/71-2-4_A-Man-for-All-Regions-Dr.-Thomas-Walker-of-Castle-Hill_McLeod-Alexander-Canady.pdf
5. *Pioneer Families of Eastern and Southeastern Kentucky* (return via Flat Lick, Warriors' Path, Hazel Green, Salyersville, Paintsville, Levisa, Tug Fork): https://archive.org/stream/pioneer-families-of-eastern-and-southeastern-kentucky/Pioneer%20Families%20of%20Eastern%20and%20Southeastern%20Kentucky_djvu.txt
6. NPS, Cumberland Gap NHP, "Dr. Thomas Walker": https://www.nps.gov/cuga/learn/historyculture/dr-thomas-walker.htm
7. Kentucky State Parks, Dr. Thomas Walker State Historic Site: https://parks.ky.gov/barbourville/parks/historic/dr-thomas-walker-state-historic-site
8. Joshua Fry & Peter Jefferson, *A Map of the Most Inhabited Part of Virginia* (1751/1755), Library of Congress: https://www.loc.gov/item/74693166/
9. Base data: Natural Earth 10 m (public domain); relief: AWS Terrain Tiles.
(Items 2, 3, 6–8 cited from bibliographic knowledge; URLs 6–8 should be verified before publishing.)

## v2 design pass (2026-10-11, Critiquito fixes)
- **Phone art (new):** `thomas-walker-and-cumberland-gap-route-map-phone.png` / `.webp` (780x439, 2x for a 390 CSS-px slot). It's a Kentucky-focused crop with only these stops: Cave Gap, Cumberland R., Walker’s cabin, toward Red River, Levisa Fork. Labels are 118 px at 3840, which is 24 px at 780. Sub-labels, towns, river labels, the legend and the credits are dropped. `thomas-walker-and-cumberland-gap-route-map-390.png` is now made from the phone art. Dark-frame version: `thomas-walker-and-cumberland-gap-route-map-phone-dark.png`; `thomas-walker-and-cumberland-gap-route-map-dark-390.png` is made from that. Serve it with `<picture><source media="(max-width: 600px)" srcset="…-phone.webp">`.
- **Credits and scale:** the credit line and the "Statute Miles" scale bar now sit on a solid parchment strip at the bottom of the frame. All labels, the cartouche, the legend and the strip are drawn above the burned edge and vignette, and labels are kept out of the outer edge.
- **Line styles:** conjectural / approximate segments are now **red dots**. Branches and other routes are **lighter, muted-red dashes**. Approximate points are red rings with a parchment fill, so a line passing through one no longer overprints it.
- **Dark version:** `thomas-walker-and-cumberland-gap-route-map-dark.png/.webp` no longer has the frame heading or "Route map" line. The map's own cartouche is the only title. The caption under the map is kept at 1600 only; on the page, render it as HTML text.

## Legend (for the page HTML, under the phone art)
- solid red line: outbound route (approximate)
- red dotted line: return loop (conjectural)
- red chevron: direction of travel
- dark dot: named place in the journal
- red ring: approximate location
- small open circle: modern town, for orientation
- fine brown dashes: modern state line
- Credit: Route after Dr. Thomas Walker’s journal, 1750 (Rives ed., 1888; Johnston, Filson Club, 1898); return per Summers and Filson Club studies; NPS Cumberland Gap. Base data Natural Earth / U.S. Census, public domain. Relief: AWS Terrain Tiles (SRTM / USGS). Map by KY History Drive, 2026. All positions approximate.
