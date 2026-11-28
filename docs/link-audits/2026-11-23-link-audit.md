# KY outbound link audit: Monday 2026-11-23

OTA `data_version` goes 113 → 114. Live was re-read as 113 immediately before the bump (`https://kyhistorydrive.com/data/app/ky-history-manifest.json`, `last_brief_date` 2026-11-17). Started from origin/main @ `11f27c3f` (the #435 merge). Not merged, not self-approved, not deployed.

Open PR #436 (Fri Nov 20 pack) also claims `data_version` 114, and #437 and #438 are open. This audit does not fold into those PRs. Whichever of this PR and #436 merges second must rebase and take the next number.

## Counts

- Checked, before edits: **3,940 unique outbound URLs (9,394 occurrences)** across the OTA pack (`public/data/app/*`, minus the derived search index), story JSON, built layers, `markers.geojson`, drive pages, and home preview. Before the audit the repo packs were byte-identical to live `https://kyhistorydrive.com/data/app/*.json` (all 16 files, including the manifest and the search index).
  - The same extractor on last Monday’s merge `64ca98ef` reproduces that report’s unique count: **3,917 unique**. Occurrences come out 9,324 against the published 9,322. Wikipedia on that commit is **288 unique / 724 occurrences**, the same pair the Nov 16 report published.
  - vs that tree: **26 new URLs, 3 gone**. The new URLs are the Tue Nov 17 pack (#434, `data_version` 113) plus the #435 drift fix’s photo and license URLs. The three gone URLs are the raw-paren Fort Jefferson Wikipedia slug (replaced by the percent-encoded slug) and the two Fort Jefferson marker `source_url`s the Nov 17 pack emptied on purpose (markers 64 and 1309). Those marker URLs were not put back.
  - 2,134 `history.ky.gov` URLs were in today’s live KHS sitemap (3,107 URLs across the seven child sitemaps, the same sitemap size as Nov 16). Every pack URL on that host was in the sitemap. A 25-URL live sample, the same method as last week, all returned HTTP 200. Marker HTML is client-rendered, so curl saw an empty `<title>`.
  - Everything else was fetched live: GET, redirects followed, title read, per-host cap. `check2.py` sends a byte range, which some hosts answer as 206; those are treated as success when the body is a real page.
  - A parked/spam scan of 691 non-KHS, non-wiki 200/206 responses found no spam or parking keywords.
  - The checker’s one Grokipedia 404 is again `Meriwether_Lewis_Clark_Jr` with the trailing period stripped by the extractor. The story link is `Meriwether_Lewis_Clark_Jr.` Fetched as written it is HTTP 200, title “Meriwether Lewis Clark Jr. — Grokipedia”. It is not dead.
- After the 25 swaps: **3,937 unique (9,394 occurrences)**. Three of the Grokipedia targets were already in the pack (`battle_of_barbourville`, `constitution_square_historic_site`, `william_whitley_house_state_historic_site`), so unique drops by 3 and the occurrence count does not change.
- Fixed: **0**.
- Removed: **0**.
- Wikipedia → Grokipedia swaps: **25 URLs (83 occurrences)**.
- Wikipedia remaining: **267 unique (650 occurrences)**. Last week ended at 288 unique / 724 occurrences. This week started at 292 / 733 because the Nov 17 pack added Bernheim Arboretum, Hopkins County, James Colbert, and Six Nations land cessions, and replaced the raw-paren Fort Jefferson slug with the percent-encoded one (net +4 unique, +9 occurrences). Then −25 URLs / −83 occurrences swapped. No Wikipedia URL was removed except by those swaps.
- Held for judgment: **3** (the same three broader-scope Wikipedia redirects; re-checked, unchanged).
- Held per the Nov 13 History ruling: **4** (Green Clay surveyor, 1788 convention vote, and reinforcements; Catawba “dismissed the tale”). Still on Wikipedia. Not swapped.
- Held on the Nov 16 History review: **2** (Moluntha’s Tecumseh sentence; Whitney Young birthplace). Still on Wikipedia. Not swapped. The Tecumseh Wikipedia URL occurs only in that Moluntha sentence. Other stories already point Tecumseh at Grokipedia, so there was no second Tecumseh Wikipedia link to swap.
- Unverified (not dead): **414**. Bot walls: 122 `loc.gov` 403s, 121 `chroniclingamerica.loc.gov` 403s, 17 historypin 403s, 16 Yelp 403s, 13 hmdb.org 403s, 8 TripAdvisor 403s, 7 ExploreKYHistory “Visitor anti-robot validation” 403s, 6 tDAR Cloudflare 403s, 12 Facebook 400 login walls, plus visit* and restaurant “Just a moment” 403s. 10 HTTP 202s (Encyclopedia Virginia, Tennessee Encyclopedia, abandonedonline, founders.archives.gov, Kentucky Living, verview). 5 HTTP 503s (Gutenberg maintenance, Restaurant Guru). 2 HTTP 429s. 1 HTTP 402 (Courier-Journal restaurant guide). 24 connection failures and 2 timeouts, the same restaurants, Encyclopedia Virginia, Tennessee Encyclopedia, abandonedonline, UNC finding aid, and UK anthropology page as prior weeks. 8 TLS failures, including the Georgia Encyclopedia Westo page already confirmed outside the box last week. The new World History Commons treaty page is in the 403s; a web search confirms the page (see judgment). It stays.

Accepted as-is, same as prior weeks and not re-flagged: Apple Maps covered-bridge links, business and distillery homepages, business About/Contact pages, the Filson root, `archaeology.ky.gov` Find-a-Site `default.aspx` in the home preview, and the prior listicle and review-site holds. Napoli’s Glasgow is still up (200, “Napolis | NapolisGlasgow”).

## Fixed / removed

None. No new dead link, homepage-of-a-general-site, search page, or parked domain turned up. The Nov 17 links that are new this week are on topic; see below.

## Nov 17 links

Re-checked live. New Grokipedia articles match their anchors (titles from this week’s fetch, all HTTP 200):

- Abraham Lincoln (the president; the Cartwright story’s vote count).
- Camp meeting.
- Castle Clinton (Castle Garden, the 1867 immigrant station).
- Conrad Weiser.
- Friedrich Wilhelm von Steuben.
- James Madison (then Secretary of State; Madisonville’s name).
- Madisonville, Kentucky (county seat, founded 1807).
- Peter Cartwright (born 1 September 1785, Amherst County).
- Thomas Lee (Virginia colonist). Encoded parentheses, `Thomas_Lee_%28Virginia_colonist%29`.
- Isaac Wolfe Bernheim (lower-case slug `isaac_wolfe_bernheim`; the capitalized slug is the one the pack uses and it is 200).
- Kentucky County, Virginia, already in the Lancaster story.

`check-grokipedia-links` on the Nov 17 stories plus the stories and OTA files this audit edits: 117 links, 0 missing.

Other new URLs, kept:

- `archive.org` Bernheim family book and the Cartwright autobiography, both 200, titles naming Isaac Wolfe Bernheim and Peter Cartwright.
- Creative Commons BY 4.0 and CC0 deeds, both 206, license titles. They are the photo license links, not topic sources.
- `en.wikipedia.org/wiki/Bernheim_Arboretum_and_Research_Forest` 200. Grokipedia has no article (capitalized and lower-case both “Article Not Found”). The “stripped for iron ore” sentence stays here.
- `en.wikipedia.org/wiki/Fort_Jefferson_%28Kentucky%29` 200, “Fort Jefferson (Kentucky) - Wikipedia”. Four sentences in the new story (the 1780 proposal, the lack of Chickasaw consent, 8 June 1781, Ballard County) stay on Wikipedia. Grokipedia `fort_jefferson_kentucky` exists and is the 1780 Clark post, but those sentences are specific claims and were not swapped this week.
- `en.wikipedia.org/wiki/Hopkins_County,_Kentucky` 200. The Madisonville sentence is the coal outcrop. Grokipedia’s county article exists (`Hopkins_County%2C_Kentucky`, 200) but the sentence was not swapped.
- `en.wikipedia.org/wiki/James_Colbert_%28trader%29` was swapped. See the batch below. The anchor is his name, “a trader who lived among the Chickasaw,” which is the Grokipedia lead, and the article covers the Fort Jefferson assault.
- `en.wikipedia.org/wiki/Six_Nations_land_cessions` 200. Two Lancaster-story sentences stay. Not in this swap batch.
- Filson PDF `71-3-2_George-Rogers-Clarks-Fort-Jefferson-1780-1781_Carstens-Kenneth-C..pdf` is HTTP 200, `content-type: application/pdf`, about 1.8 MB. The box title was empty because it is a PDF. Kept.
- `worldhistorycommons.org/excerpts-treaty-lancaster-1744` returned 403 with `x-blocked: true` from this box. A web search of that URL returns the page “Excerpts from the Treaty of Lancaster (1744) | World History Commons”. The text includes the court house at Lancaster, Canassatego’s “what is one hundred years” speech, and the introduction’s note that Virginia granted 300,000 acres within the year. Unverified fetch, right page, kept.
- `www.virginiaplaces.org/settleland/ohio.html` is 206, title “Ohio Company”. The page is the Ohio Company organized after the 1744 Treaty of Lancaster and discusses the sea-to-sea claim the sentence cites. Kept.
- `www.wvencyclopedia.org/entries/736` is 200, “e-WV - Treaty of Lancaster”. Kept.
- Sotheby’s I. W. Harper collector’s guide is 206, title “I.W. Harper: A Comprehensive Collector’s Guide”. Kept.
- New `history.ky.gov` marker URLs used by the Madisonville and Cartwright stories (county-named-1806, Steuben’s Lick, Madisonville, Army of Six, Hockersmith House, courthouse burned, boyhood home) are inside the KHS sitemap set.

## Grokipedia swaps (25)

Each target was fetched today (HTTP 200). The title and lead are the same subject as the Wikipedia article. Inline anchors that were already the person’s or place’s name were left as names. Labels that said `Wikipedia:` or `(Wikipedia)` now say `Grokipedia:` or `(Grokipedia)`. Parentheses in the Richard Taylor slug are percent-encoded. Drive pages that carried these labels were updated and `build-drive-pages` rewrote 0 further files, so the HTML already matched the STOPS arrays.

Cemetery `bio_url` (1 occurrence each, except Old Mulkey which is also a source):

- `georgetown-cemetery` Edward Troye → `https://grokipedia.com/page/edward_troye` (200, “Edward Troye — Grokipedia”, Swiss-born painter of Thoroughbreds, 1808–1874). The capitalized slug 404s; the lower-case slug is the one that exists.
- `sons-daughters-of-relief-cemetery` Edward Dudley Brown → `https://grokipedia.com/page/edward_d_brown` (200, “Edward D. Brown — Grokipedia”, the Kentucky jockey and trainer, c. 1850–1906).
- `georgetown-cemetery` George W. Johnson → `https://grokipedia.com/page/george_w_johnson_governor` (200, “George W. Johnson (governor) — Grokipedia”, Confederate provisional governor, 1811–1862).
- `georgetown-cemetery` James F. Robinson → `https://grokipedia.com/page/james_fisher_robinson` (200, “James Fisher Robinson — Grokipedia”, 22nd governor of Kentucky).
- `lexington-cemetery` James Lane Allen → `https://grokipedia.com/page/james_lane_allen` (200, “James Lane Allen — Grokipedia”, the Kentucky novelist, 1849–1925).
- `cave-hill-cemetery` Patty Hill → `https://grokipedia.com/page/Patty_Hill` (200, “Patty Hill — Grokipedia”, Patty Smith Hill, 1868–1946). The capitalized slug is the one that returned 200.
- `zachary-taylor-national-cemetery` Richard Taylor → `https://grokipedia.com/page/Richard_Taylor_%28colonel%29` (200, “Richard Taylor (colonel) — Grokipedia”, Continental Army officer, 1744–1829). Encoded parentheses.
- `old-mulkey-meetinghouse` source, and the Hannah Boone Pennington `bio_url` that already pointed at the meetinghouse article → `https://grokipedia.com/page/old_mulkey_meetinghouse` (200, “Old Mulkey Meetinghouse — Grokipedia”, the 1804 log church in Monroe County). There is no Grokipedia page for Hannah Boone or Hannah Boone Pennington (both 404). The bio stays on the meetinghouse article, which is the page the record already used.

Site `sources` / `website` (and the drive label where the drive carried the same URL):

- `barbourville-battle` source → `https://grokipedia.com/page/battle_of_barbourville` (200, “Battle of Barbourville — Grokipedia”, the 19 September 1861 skirmish). The Barbourville story already used this lower-case slug. The capitalized slug 404s.
- heaven-hill drive, Kentucky Railway Museum → `https://grokipedia.com/page/kentucky_railway_museum` (200, “Kentucky Railway Museum — Grokipedia”, New Haven). Label is now “Grokipedia: Kentucky Railway Museum”.
- `weisenberger-mill` source and the woodford-reserve drive → `https://grokipedia.com/page/weisenberger_mills_and_related_buildings` (200, “Weisenberger Mills and Related Buildings — Grokipedia”, the South Elkhorn district in Scott and Woodford Counties).
- `columbus-belmont-state-park` source and the western-rivers drive → `https://grokipedia.com/page/columbus_belmont_state_park` (200, “Columbus-Belmont State Park — Grokipedia”, the Hickman County bluff).
- `lloyd-tilghman-house` website and source, and the western-rivers drive → `https://grokipedia.com/page/lloyd_tilghman_house` (200, “Lloyd Tilghman House — Grokipedia”, the 1852 Paducah house). The drive already had a separate “Grokipedia: Lloyd Tilghman” link for the man. That one stays.
- `pewee-valley-confederate-cemetery` website, sources, and `why_historic_url` (war site and cemetery) → `https://grokipedia.com/page/pewee_valley_confederate_cemetery` (200, “Pewee Valley Confederate Cemetery — Grokipedia”, the 1904 burial ground in Oldham County).
- `old-state-house` and `old-state-capitol` sources, and the buffalo-trace, capital-and-shakers, and castle-and-key drives → `https://grokipedia.com/page/old_state_capitol_kentucky` (200, “Old State Capitol (Kentucky) — Grokipedia”, the 1827–1830 Greek Revival capitol). Label is now “Grokipedia: Old State Capitol (Kentucky)”.
- `fort-duffield` website and source, and the jim-beam drive → `https://grokipedia.com/page/fort_duffield` (200, “Fort Duffield — Grokipedia”, the Union earthwork above West Point).
- `constitution-square` website and source, and the capital-and-shakers drive → `https://grokipedia.com/page/constitution_square_historic_site` (200, “Constitution Square Historic Site — Grokipedia”, the Danville square).

Stories and the History pin `website` that cites the same article:

- `levi-todd-lexington-co-founder` and pin `levi-todd-ellerslie-lexington` → `https://grokipedia.com/page/levi_todd` (200, “Levi Todd — Grokipedia”, Lexington co-founder, 1756–1807). Label is now “Levi Todd (Grokipedia)”.
- `harry-innes` and pin `harry-innes-frankfort-1783-1816` → `https://grokipedia.com/page/harry_innes` (200, “Harry Innes — Grokipedia”, first U.S. district judge for Kentucky, 1752–1816). Label is now “Harry Innes (Grokipedia)”.
- `hugh-mcgary-the-blue-licks-hothead`, the Moluntha story’s source line, and pin `mcgarys-station-shawnee-springs-mercer` → `https://grokipedia.com/page/hugh_mcgary` (200, “Hugh McGary — Grokipedia”, 1744–1806, McGary’s Station near Shawnee Springs). Label is now “Hugh McGary (Grokipedia)”. The Moluntha Tecumseh sentence is a different URL and stays on Wikipedia.
- `col-john-hardin-of-pleasant-run` and pin `john-hardin-pleasant-run-washington-1786-1792` → `https://grokipedia.com/page/john_hardin` (200, “John Hardin — Grokipedia”, the soldier and surveyor, 1753–c. 1792).
- `owensboro-yellow-banks` William Smeathers (the name in the 1797 Yellow Banks sentence, and the source line) → `https://grokipedia.com/page/william_smeathers` (200, “William Smeathers — Grokipedia”). The article calls him Smothers, puts him on the Rough River in 1782, at Hartford and Vienna, and building a cabin at Yellow Banks (Owensboro) in 1797.
- `fort-jefferson-clarks-fort-on-chickasaw-ground` James Colbert → `https://grokipedia.com/page/james_colbert_trader` (200, “James Colbert (trader) — Grokipedia”, James Logan Colbert, trader among the Chickasaw, and the article mentions the assault on Fort Jefferson).
- `pine-mountain-and-pound-gap`, pin `pound-gap-pine-mountain-letcher-1750-1864`, and the big-sandy drive → `https://grokipedia.com/page/pound_gap` (200, “Pound Gap — Grokipedia”, the gap between Jenkins and Pound). Label is now “Grokipedia: Pound Gap”.
- `esther-whitley-over-the-cumberlands-1775` source line, plus `william-whitley-house` and `william-whitley-house-war`, and the boones-trail drive → `https://grokipedia.com/page/william_whitley_house_state_historic_site` (200, “William Whitley House State Historic Site — Grokipedia”, the Lincoln County house). The Esther Whitley Wikipedia source beside it was not swapped. Label is now “William Whitley House State Historic Site (Grokipedia)”.

Not swapped, even though a page exists or was probed: anything past this batch of 25. In particular Henry Skaggs stays on Wikipedia. Grokipedia `henry_skaggs` is 200 and is the longhunter, but the lead dates him c. 1732–1810 while the story’s “according to his biography” sentence uses the Wikipedia article for the 8 January 1724 birth and the 1764 Cumberland Gap party. `Joseph_Desha`, `John_L._Helm`, `Richard_Hawes`, `Lazarus_W._Powell`, `Ephraim_Brank`, `Thomas_Hines`, `George_Nicholas_(lawyer)`, `John_Y._Brown_(politician,_born_1835)`, `Joseph_Horace_Lewis`, `Whiskey_Row,_Louisville`, and `Bernheim_Arboretum_and_Research_Forest` returned “Article Not Found” on both the capitalized and the lower-case slug. Spalding Hall’s Grokipedia article dates the standing building to 1839; the drive text says 1826, so that Wikipedia source stays. Archaeological `Turk_Site` was not mapped to Grokipedia `turk_site`.

## Held per the Nov 13 History ruling

These four sentences stay on Wikipedia. They were not pointed at Grokipedia.

- `gen-green-clay-the-surveyor-who-built-clermont`: “deputy surveyor of Lincoln County” → `https://en.wikipedia.org/wiki/Green_Clay`.
- `gen-green-clay-the-surveyor-who-built-clermont`: “Virginia ratifying convention of 1788” → `https://en.wikipedia.org/wiki/Green_Clay`.
- `gen-green-clay-the-surveyor-who-built-clermont`: “knew no reinforcements were coming” → `https://en.wikipedia.org/wiki/Green_Clay`.
- `the-catawba-and-the-northern-war-parties`: “dismissed the tale” → `https://en.wikipedia.org/wiki/Catawba_people`.

## Held on the Nov 16 History review

- `moluntha-and-logans-raid-1786`: “In 1810 Tecumseh still pointed to Moluntha’s death…” → `https://en.wikipedia.org/wiki/Tecumseh`. This is the only remaining Tecumseh Wikipedia URL in the OTA scope.
- `whitney-m-young-birthplace` in `public/data/app/national-sites.json` stays `https://en.wikipedia.org/wiki/Whitney_Young`.

## Held (re-check next Monday)

- story `col-william-russell-iii`: `en.wikipedia.org/wiki/Siege_of_Fort_Harrison` still serves the title “Fort Harrison, Indiana - Wikipedia”. Grokipedia `Siege_of_Fort_Harrison` is “Article Not Found”.
- story `col-william-russell-iii`: `en.wikipedia.org/wiki/Peoria_War` still serves “Illinois Territory in the War of 1812 - Wikipedia”. Grokipedia `Peoria_War` is “Article Not Found”.
- story `richard-henderson`: `en.wikipedia.org/wiki/Treaty_of_Sycamore_Shoals` still serves “Transylvania Colony - Wikipedia”. Grokipedia has no `Treaty_of_Sycamore_Shoals` article. It does have `Transylvania_Colony` (200). That is the broader page the Wikipedia link already lands on, so it was not swapped.

## Notes

- Layers were rebuilt with `KY_LAYER_JSON_DIR=public/data/app` (history 214, museums 94, national 36, war 50, locals 276, bridges 11, industry 103, newspapers 121, parks 46, cemeteries 56, distilleries 55, stories 219). Website is copied into the layer; `sources` and `bio_url` are not. The rebuild’s other diffs were reverted: 80 history features (county, geocode, and text drift) and 3 industry cross-list text normalizations. The committed layer diff is only the swapped `website` values: 5 history pins, 4 war sites, 2 museums, 1 cemetery. `ky-markers-drive` was not touched.
- `npm run build` (the Amplify build) was run locally. It passed `test-pin-cards` at data_version 114, `test-drive-links` (6,300 leg URLs), `check-story-portraits` (261 stories), `check-related-portraits`, `check-portrait-thumbs`, and every earlier step. The last command, `check-protected-coords`, exits because `PROTECTED_COORDS_KEY` is not set in this VM. Amplify injects that secret; the in-build `test-protected-coords` fixture cases passed. The build also rewrote stories, photos, pin art, `stories.json`, search index, and layer files. That generated churn was reverted. The committed diff is the link edits, the manifest bump, the pin-card expectation, the generated-diff allowlist, and this report.
- `check-generated-diff` compares story files with `origin/v2`. The allowlist now also names the John Hardin and Pound Gap stories and the History pin ids whose `website` moved (McGary’s Station, Levi Todd / Ellerslie, John Hardin’s Pleasant Run, Pound Gap). After that, `check-generated-diff --worktree` is ok.
- check-ota-types ok, test-ota-types ok, test-grokipedia-links ok, check-grokipedia-links 117 links / 0 missing, test-markdown-link-parens ok, test-drive-links ok (6,300 leg URLs), test-pin-cards ok at 114. Richard Taylor `%28colonel%29` is ok. Direct fetch of that encoded URL returned 200.
- Research JSON, raw briefs, and `docs/tribal-review-packet.md` still contain some Wikipedia URLs. They are outside the OTA edit scope and were not changed. `public/content/research/moluntha-and-logans-raid-1786.json` still has the Hugh McGary Wikipedia URL; the story JSON and the OTA pin do not.
- Scripts and status files for this run are under `/tmp/ky-link-audit/2026-11-23/` (`occ.json`, `occ-after.json`, `status.json`, `khs_sitemap.txt`, `spamscan.json`, `grokcheck.log`, `npm-build.log`).
