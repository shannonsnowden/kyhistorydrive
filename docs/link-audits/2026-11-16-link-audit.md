# KY outbound link audit: Monday 2026-11-16

PR: opened from this branch to main. OTA `data_version` goes 111 → 112. Live was re-read as 111 immediately before the bump (`https://kyhistorydrive.com/data/app/ky-history-manifest.json`, `last_brief_date` 2026-11-13). Started from origin/main @ `d1cb2863`. Not merged, not self-approved, not deployed.

## Counts

- Checked, before fixes: **3,923 unique outbound URLs (9,323 occurrences)** across the OTA pack (`public/data/app/*`, minus the derived search index), story JSON, built layers, `markers.geojson`, drive pages, and home preview. Before the audit the repo packs were byte-identical to live `https://kyhistorydrive.com/data/app/*.json` (all 16 files, including the manifest and the search index).
  - vs last week (post-audit `fe9fc6cc`, 3,875 unique / 9,203 occurrences): **48 new URLs, 0 gone**. The new URLs are the Nov 10 and Nov 13 packs (Green Clay, Barbourville, Aristides, Cold Oak, Catawba, plus James Smith, Westo, Middlesboro, and Princeton).
  - 2,136 `history.ky.gov` URLs were in today's live KHS sitemap (3,107 URLs across the seven child sitemaps). A 25-URL live sample, the same method as last week, all returned HTTP 200. Marker HTML is client-rendered, so curl often saw an empty `<title>`.
  - Everything else was fetched live with the same curl checker as last week: GET, redirects followed, title read, per-host cap. `check2.py` sends a byte range, which some hosts answer as 206; those are treated as success when the body is a real page.
  - A parked/spam scan of 672 non-KHS, non-wiki 200/206 responses found no spam or parking keywords.
  - Grokipedia direct fetch works this week. Every `grokipedia.com/page/...` URL as written in the pack returned 200. The checker’s one Grokipedia 404 was `Meriwether_Lewis_Clark_Jr` with the trailing period stripped. The story link is `Meriwether_Lewis_Clark_Jr.` (Wikipedia’s “Jr.” slug). That exact URL is 200, title “Meriwether Lewis Clark Jr. — Grokipedia”, lead is the Churchill Downs founder. It is not dead.
- After fixes: **3,914 unique (9,322 occurrences)**.
- Fixed: **2** (1 dead Hopewell marker page, 1 Stitzel source that has been down for three Mondays).
- Removed: **0**.
- Wikipedia → Grokipedia swaps: **25 URLs (27 occurrences)**.
- Wikipedia remaining: **284 unique (718 occurrences)**. Last week was 307 unique / 741 occurrences. This week started at 309 / 745 because Green Clay and Catawba added two Wikipedia links; then −25 swapped. No Wikipedia URL was removed.
- Held for judgment: **3** (the same three broader-scope Wikipedia redirects; re-checked, unchanged).
- Unverified (not dead): **414** from the box, after dropping the two fixed defects. Bot walls: 122 `loc.gov` 403s, 121 `chroniclingamerica.loc.gov` 403s, 17 historypin 403s, 16 Yelp 403s, 13 hmdb.org 403s, 8 TripAdvisor 403s, 12 Facebook 400 login walls, 6 tDAR Cloudflare 403s, plus visit* and restaurant “Just a moment” 403s. 19 HTTP 202s (Encyclopedia Virginia, Tennessee Encyclopedia, abandonedonline, founders.archives.gov, Kentucky Living). 8 HTTP 503s (Gutenberg maintenance, Restaurant Guru). 5 HTTP 429s. 1 HTTP 402 (Courier-Journal restaurant guide, same paywall as prior weeks). 14 connection failures and 3 timeouts, mostly restaurants and the same UNC finding aid / Lincoln Museum / UK anthropology page as prior weeks. 10 TLS failures remain after the Stitzel fix; the new Georgia Encyclopedia Westo page was confirmed by an outside fetch (see judgment).

Accepted as-is, same as prior weeks and not re-flagged: 11 Apple Maps covered-bridge links, which resolve to `maps.apple.com/place?...name=<bridge>`; business About/Contact pages; `aph.org/museum` → `thedotexperience.org`; the Filson root; `archaeology.ky.gov` Find-a-Site `default.aspx` in the home preview. Prior listicle and review-site holds were not re-opened. Napoli’s Glasgow is still up (200, “Napolis | NapolisGlasgow”).

## Fixed / removed

- story `jacob-spears-early-bourbon-whiskey`: “Hopewell Museum in Paris” linked to `https://www.hopewellmuseum.org/learn/historic-preservation/bourbon-county-historical-markers/bourbon-whiskey-jacob-spears/`, which returns 404 “Not found” (the museum homepage itself is 200). The sons-and-flatboats sentence is on the live ExploreKYHistory page for that marker, credited “By Hopewell Museum”. The link now points to `https://explorekyhistory.ky.gov/items/show/427` (200, “Bourbon Whiskey/Jacob Spears | ExploreKYHistory”). Anchor text is now “Hopewell Museum account of the Jacob Spears marker”.
- story `frederick-stitzels-barrel-racks-1879`: `https://historiclouisville.com/?p=4568` (2 occurrences, the URL was both the label and the href). Third Monday down. The box gets a TLS failure; `curl -k` then returns 404. Replaced with `https://pre-prowhiskeymen.blogspot.com/2021/09/frederick-stitzel-thomas-edison-of.html` (200 on https and http, title “Those Pre-Pro Whiskey Men!: Frederick Stitzel — The Thomas Edison of Whiskey”). The page is about Frederick Stitzel, the 1879 rack patent, and Stitzel Brothers at the Glencoe Distillery. Label is “Frederick Stitzel and Stitzel Brothers”. The bourbonveach and Distillery Trail sources stay.

## Nov 10 and Nov 13 links

Re-checked live. The new Grokipedia articles match their anchors: Green Clay (surveyor, 1757–1828), Cassius Marcellus Clay (the Kentucky abolitionist, not the boxer), Henry Knox (Secretary of War), Felix Zollicoffer (the Confederate general), Battle of Barbourville (19 September 1861), Aristides (horse), Oliver Lewis, Ansel Williamson, 1875 Kentucky Derby, Churchill Downs, Middlesboro crater, Shatter cone, Pennsylvanian (geology), Princeton, Kentucky, Trail of Tears, Catawba people, Braddock Expedition, Iroquois, Erie people. `check-grokipedia-links` on the changed stories plus the Nov 13 stories: 45 links, 0 missing.

Other new URLs that are on-topic and kept:

- `archaeology.ky.gov` Cold Oak page, 206, title “Cold Oak - Discover Kentucky Archaeology”.
- `archipel.uqam.ca/10139/` is Alexandre Ouellette’s 2017 thesis on French involvement in southern Indigenous wars, 1701–1760, including raids on the Catawba. The HTML `<title>` is the repository name; the item title is on the page.
- `core.tdar.org` document 171329 is Kristen Gremillion’s 1993 Cold Oak article. tDAR’s own title spells it “Coal Oak Shelter”. The box got Cloudflare 403, so the fetch is unverified; a web search of that record id confirms Lee County, 1993, Midcontinental Journal of Archaeology 18:161–189. Kept.
- Filson Green Clay papers redirect to `/research-doc/clay-green-1757-1828-papers-1780-1834/` and stay on that finding aid (200).
- `kyatlas.com/ky-clays-ferry.html` is 200, “Clays Ferry, Kentucky”, the ferry in the Green Clay story, not a county homepage.
- Cambridge American Antiquity abstract is 200, “Early Agricultural Diet in Eastern North America: Evidence from Two Kentucky Rockshelters”.
- Rennick “Knox County - Place Names” is 200. NKAA item 2409 is 200, “Knox County (KY) Enslaved, Free Blacks, and Free Mulattoes, 1850-1870”.
- NPS asset `84003885_text` returned 200 with an empty title (PDF). Left in place.
- Charleston “Committee of Conference Upon Indian Affairs Report (May 1751)” is 200. South Carolina Encyclopedia “Westos” is 200. Virginia Places “Rickahocan/Westo” is 206.
- Archive.org James Smith narrative is 200. KHS Colonel James Smith and Middlesboro crater marker URLs are in the sitemap.

Unverified new fetches, kept: Encyclopedia Virginia “Indian enslavement in Virginia” (202, same host pattern as prior weeks), Duke University Press Ethnohistory abstract (Cloudflare 403), Morehead State `viewcontent.cgi` (Cloudflare 403), Heinz History Center James Smith post (403), USDA treesearch PDF (206, empty title), Georgia Encyclopedia Westo page (box TLS; outside fetch 200, “Westo Indians - New Georgia Encyclopedia”).

## Grokipedia swaps (25)

Each target was fetched today (200). The title and lead are the same subject as the Wikipedia article. Inline anchors that were already the person’s or place’s name were left as names. None of these 25 were labeled “Wikipedia: …” in the OTA JSON or story markdown, so there was no label string to rewrite. Drive pages do not carry these 25 URLs, so `build-drive-pages` was not required for labels.

Cemetery `bio_url` (1 occurrence each):

- `lexington-cemetery` John C. Breckinridge → `https://grokipedia.com/page/John_C._Breckinridge` (“John C. Breckinridge — Grokipedia”).
- `lexington-cemetery` John Hunt Morgan → `https://grokipedia.com/page/John_Hunt_Morgan`.
- `frankfort-cemetery` Rebecca Boone → `https://grokipedia.com/page/Rebecca_Boone`.
- `frankfort-cemetery` Richard Mentor Johnson → `https://grokipedia.com/page/Richard_Mentor_Johnson`.
- `frankfort-cemetery` William Goebel → `https://grokipedia.com/page/William_Goebel`.
- `frankfort-cemetery` Presley O’Bannon → `https://grokipedia.com/page/Presley_O%27Bannon` (“Presley O'Bannon”).
- `cave-hill-cemetery` Muhammad Ali → `https://grokipedia.com/page/Muhammad_Ali` (Louisville boxer).
- `cave-hill-cemetery` Harland Sanders → `https://grokipedia.com/page/Colonel_Sanders`.
- `zachary-taylor-national-cemetery` Zachary Taylor → `https://grokipedia.com/page/Zachary_Taylor`.
- `zachary-taylor-national-cemetery` Margaret Mackall Smith Taylor → `https://grokipedia.com/page/Margaret_Taylor`.

National-site `sources` (1 each):

- `churchill-downs` → `https://grokipedia.com/page/Churchill_Downs`.
- `keeneland-race-course` → `https://grokipedia.com/page/Keeneland`.
- `whitney-m-young-birthplace` → `https://grokipedia.com/page/Whitney_Young` (Kentucky social-work career in the lead).
- `belle-of-louisville` → `https://grokipedia.com/page/Belle_of_Louisville`.
- `ashland-henry-clay` → `https://grokipedia.com/page/Ashland_(Henry_Clay_estate)`.
- `louisville-water-tower` → `https://grokipedia.com/page/Louisville_Water_Tower`.
- `locust-grove` → `https://grokipedia.com/page/historic_locust_grove` (the capitalized slug 404s “Article Not Found”; the lower-case slug is 200 and is the Croghan/Clark house in Jefferson County). 
- `zachary-taylor-house` → `https://grokipedia.com/page/zachary_taylor_house` (same pattern: capitalized slug is “Article Not Found”; lower-case is 200, Springfield, Jefferson County, boyhood home).

Stories:

- `hartford-fort-hartford-on-the-rough-river`: Ohio River → `https://grokipedia.com/page/Ohio_River`.
- `treaty-of-fort-mcintosh-1785`: Arthur Lee → `https://grokipedia.com/page/Arthur_Lee_(diplomat)`.
- `gen-green-clay-the-surveyor-who-built-clermont`: Green Clay, 3 occurrences → `https://grokipedia.com/page/Green_Clay` (already used elsewhere in the same story).
- `moluntha-and-logans-raid-1786`: Tecumseh, Shawnee, and Northwest Indian War → the matching `grokipedia.com/page/` URLs.
- `the-catawba-and-the-northern-war-parties`: Catawba people → `https://grokipedia.com/page/Catawba_people`.

Not swapped, even though a page exists: anything past this batch of 25. In particular `Battle_of_Barbourville` on Wikipedia was left; Grokipedia’s capitalized slug 404s, and the lower-case `battle_of_barbourville` article (200, the 19 September 1861 skirmish) is already the link in the Barbourville story. `Joseph_Desha`, `John_L._Helm`, `Richard_Hawes`, `Lazarus_W._Powell`, `Whiskey_Row,_Louisville`, and `Edward_Troye` (capitalized) returned “Article Not Found”. `edward_troye` lower-case does exist and is the horse painter; it was not in this batch. Archaeological `Turk_Site` was not mapped to Grokipedia `turk_site`.

## Held (re-check next Monday)

- story `col-william-russell-iii`: `en.wikipedia.org/wiki/Siege_of_Fort_Harrison` still serves the title “Fort Harrison, Indiana - Wikipedia” (the article covers the 1812 siege, and it is broader). Grokipedia `Siege_of_Fort_Harrison` is “Article Not Found”.
- story `col-william-russell-iii`: `en.wikipedia.org/wiki/Peoria_War` still serves “Illinois Territory in the War of 1812 - Wikipedia”. Grokipedia `Peoria_War` is “Article Not Found”.
- story `richard-henderson`: `en.wikipedia.org/wiki/Treaty_of_Sycamore_Shoals` still serves “Transylvania Colony - Wikipedia”. Grokipedia has no `Treaty_of_Sycamore_Shoals` article. It does have `Transylvania_Colony` (200). That is the broader page the Wikipedia link already lands on, so it was not swapped. The Editor can take that swap later if they want it.

`historiclouisville.com/?p=4568` is cleared by the Stitzel replacement above.

## Notes

- Layers were rebuilt with `KY_LAYER_JSON_DIR=public/data/app` (history 209, museums 94, national 36, war 50, locals 276, bridges 11, industry 103, newspapers 121, parks 46, cemeteries 56, distilleries 55, stories 215). The swapped fields are `bio_url` and `sources`, which the layer builder does not copy, and the story-body swaps are not in `ky-history.json`. The rebuild’s other diffs were reverted: 77 history features (county dropped or replaced, plus geocode and photo drift on a few pins, including marker-number drift on Green Clay, Barbourville, and Aristides) and 3 industry cross-list text normalizations. `stories.geojson` feature count did not change. `ky-markers-drive` was not touched.
- `npm run build` (the Amplify build) was run locally. It passed `test-pin-cards` at data_version 112 and every earlier step. The last command, `check-protected-coords`, exits because `PROTECTED_COORDS_KEY` is not set in this VM. Amplify injects that secret; the in-build `test-protected-coords` fixture cases passed. The build also rewrote stories, photos, pin art, `stories.json`, and both layer files. That generated churn was reverted. The committed diff is only the link edits, the manifest bump, the pin-card expectation, and the generated-diff allowlist.
- `check-generated-diff` compares story files with `origin/v2` (`034b726f`, still the Dee Felice merge). Eight stories already on main differed from that base and were not allowlisted, so a local `npm run build` failed the guard before this audit. The allowlist now names those eight (Cane Ridge, Carrollton, Chickamauga, Cornstalk, Hugh McGary, Jacob Beam, Little Turtle, Mingo camps) plus the three this audit edits (Hartford, Jacob Spears, Treaty of Fort McIntosh). After that, `check-generated-diff --worktree` is ok. Amplify’s production build on `main` skips the guard when the `origin/v2` ref is absent; a PR build that has the ref would have failed without this allowlist.
- check-ota-types ok, test-ota-types ok, test-grokipedia-links ok, check-grokipedia-links 45 links / 0 missing, test-markdown-link-parens ok, test-drive-links ok (6,280 leg URLs), test-pin-cards ok at 112.
- Research JSON, raw briefs, and `docs/tribal-review-packet.md` still contain some Wikipedia URLs. They are outside the OTA edit scope and were not changed.
- Scripts and status files for this run are under `/tmp/ky-link-audit/2026-11-16/` (`occ.json`, `status.json`, `khs_sitemap.txt`, `spamscan.log`, `npm-build.log`).
