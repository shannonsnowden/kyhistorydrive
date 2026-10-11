# Benchmark: ideas for kyhistorydrive.com (October 2026)

KY Website Editor looked at 10 live sites on 2026-10-11. The table lists ideas the site does not have yet. Before writing it we checked a live story page (`/stories/annis-mound-village/`). It already has a breadcrumb, Article/Place JSON-LD, "Learn more" sources, related stories and map/timeline links. It has no citation, no revised date, no nearby list and no visit info.

**Impact**: H, M or L, judged on reader value, search and AI citation, and return visits. **Effort**: S (a day or less, one template), M (a few days, new data or a new page type), L (a week or more).

## Top 10
| # | Idea | From | Why it fits kyhistorydrive | Impact | SEO impact | Effort |
|---|---|---|---|---|---|---|
| 1 | **"Cite this story" block with byline, published and last-revised dates** | e-WV ("Cite This Article", "Last Revised"), Encyclopedia Virginia | Stories are sourced but give no date or citation. A citation line plus `dateModified` in the Article JSON-LD builds trust, helps teachers and makes stories easier for AI answers to cite. Effort is M because published and revised dates must be backfilled across about 230 stories, plus `dateModified` in the JSON-LD. | H | H | M |
| 2 | **Nearby markers and stories, with distance** | HMdb ("At least 8 other markers are within walking distance… a few steps / 300 feet away") | Every story already has coordinates, and the marker layer is in the repo. A "Nearby" list fits the road-trip audience on a phone and adds internal links. | H | H | S |
| 3 | **"On this day in Kentucky history"** module and dated pages | History.com (This Day in History), Encyclopedia Virginia (On This Day), e-WV (Today in WV History) | Gives readers a daily reason to return alongside the daily packs, and matches searches like "October 11 Kentucky history". Needs exact dates on stories that have them. | H | M (one page per day with several stories, so the pages aren't thin) | M |
| 4 | **County and A to Z browse pages** | Encyclopedia Virginia (History A–Z), HMdb (Places by state, county and town) | Stories already carry a county ("Butler County · Prehistoric"). A crawlable page per county is how locals search ("history in Butler County KY") and strengthens site structure. | H | H | M |
| 5 | **Curated marker tours with stop counts** | ExploreKYHistory ("Harrodsburg 250th Anniversary Marker Tour, 29 Locations"), HMdb (tag-list driving tours) | Takes the six route maps on `/routes/` from maps to stop-by-stop drives. This is the clearest "Drive" feature and works well with the coming iPhone app. | H | H | M |
| 6 | **Topic hubs (multi-part exhibits)** such as Mississippian Kentucky, Mills, or Shawnee and Cherokee lands | e-WV ("Related Exhibits… 13 Sections"), Encyclopedia Virginia (featured topics) | Groups existing stories with their map layer and timeline range. Builds topic depth for SEO and AEO without new research. | H | H | M |
| 7 | **Standard photo credit and license line** (photographer, source, PD or CC license, date) | HMdb (FAQ 35: "By Name (PD) via Wikimedia Commons"), Library of Congress (rights statements on items) | Turns the charter's "licensed and attributed" rule into a fixed template that reviewers can check. Pairs with the "later view" caption. | M | M | S |
| 8 | **GPX and KML download** for route maps and tours | HMdb (map page "download GPX waypoints… KML for Google Earth") | Road-trippers can load stops into a car or hiking app. The data already exists, so this is small. | M | L | S |
| 9 | **"Report a correction or missing marker" link** on story and marker pins | HMdb (missing, moved and replaced marker status; reader commentary) | Readers at the roadside are the best way to find markers that have moved or gone missing. It keeps pins accurate, which the quality bar requires. | M | L | S |
| 10 | **"Know before you go" box** on place stories (public or private, hours link, parking, accessibility) | NPS (Plan Your Visit, Accessibility), Atlas Obscura (Know Before You Go) | Many places are on private land or are protected caves. A short visit note keeps readers safe and respects sites. Link to the official page and don't repeat hours. | M | M | M |

## Also considered (ranked lower)
| # | Idea | From | Why it fits | Impact | SEO impact | Effort |
|---|---|---|---|---|---|---|
| 11 | Primary source spotlight: one public-domain map, letter or photo per story | Library of Congress, National Archives, Encyclopedia Virginia (homepage shows a c. 1791 county map) | Adds real period images under the photo rule | M | M | M |
| 12 | Email newsletter: "a Kentucky story in your inbox" | Smithsonian Magazine | Builds a direct audience beyond search. Needs a provider and Shannon's decision on privacy | M | L | M |
| 13 | "Hidden history" collection pages by region | Atlas Obscura ("93 Cool and Unusual Things to Do in Kentucky") | Good for search and sharing. Overlaps with topic hubs | M | M (watch for overlap with topic hubs) | M |
| 14 | Print and save-as-PDF styling for stories and tours, with ads hidden | HMdb (FAQ 38) | Useful offline on a drive | L | L | S |
| 15 | Related quizzes per topic | e-WV (Related Quizzes) | Return visits and classroom use | L | L | M |
| 16 | Educator page that maps stories to grade-level themes | National Archives (Educator Resources), Library of Congress (Teachers) | Opens a new audience but needs curriculum work | M | M | L |

## Sources checked (live, 2026-10-11)
history.com/this-day-in-history · smithsonianmag.com/history · archives.gov · nps.gov/maca (Mammoth Cave home and Plan Your Visit) · hmdb.org (marker page and FAQ) · explorekyhistory.ky.gov · atlasobscura.com/things-to-do/kentucky · loc.gov · encyclopediavirginia.org · wvencyclopedia.org (home and the "Abolitionism" entry)

Shannon approved all 10 ideas on 2026-10-11 and wants profile support built in where it helps.
