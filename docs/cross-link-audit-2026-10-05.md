# Cross-link audit — 2026-10-05

Full-site pass on the web-only related-stories data (`public/data/web/related-people.json`). No story prose was edited. No `data_version` bump. iOS / `ky-markers-drive` were not touched.

## Counts

| | On main before this pass | After |
|---|---:|---:|
| Stories with a related list | 28 | 99 |
| Related link rows | 56 | 172 |
| People aliases (`people`) | 15 | 24 |

The earlier snapshot (~22 stories / ~48 links / ~13 aliases) was the PR #150 set before the Oct 4–5 packs added a few rows (Hoy, Hardin, Carrollton, Rowlandton). This pass started from that file (28 / 56 / 15) and added **116** link rows and **9** aliases.

New aliases: Stephen Trigg, John Filson, William Christian, James Knox, Jacob Beam, Lewis Craig, John Strode, Henry Bird, Dragging Canoe. Still no bare Boone, Logan, or Clark.

## Rule

A new row was added only when that story’s own text names the other story’s person, place, or event. Reciprocal rows were added only when the other text names the link too. Duplicate articles about the same site or person use “Another story about…”. Family labels are used only where the text states the relationship (Hart’s daughter and Isaac Shelby; Hardin’s existing Logan marriage note).

## Recent packs

Linked from their own text:

- John Hardin → Benjamin Logan (family, already present), Mascouten, Kickapoo, and Scott’s 1791 Wabash / Wea raid.
- Carrollton / Port William → the Travelling Church (Lewis Craig; already present). “Lewis Craig” now auto-links.
- Rowlandton → Twin Mounds and Wickliffe (already present), plus Tolu.
- Hoy’s Station → John Holder (already present) and the Wyandot frontier story.
- Portland Canal → Falls of the Ohio.

No supported pair in the text, so no row:

- Shaker Village of Pleasant Hill, Camp Nelson (the 1863 depot), Andalex Village, Hidden River Cave, and the 1805 Tellico cession. The Chickamauga stories’ 1794 Tellico Blockhouse peace is a different event. “Camp Nelson” in the Kentucky River Palisades story is the limestone bed, not the Civil War camp.

## Left out on purpose

- Travel-corridor mentions of Cumberland Gap (long hunters, the Travelling Church, Finley) are not Thomas Walker’s 1750 survey.
- Michael Stoner’s “Capt. William Russell” in 1774 is the father, not Col. William Russell III (born 1758). Russell III does link to Isaac Shelby for Kings Mountain, which his own text states.
- Carrollton’s 1789 Charles Scott blockhouse is not the 1791 Wabash raid.
- Tribal name-drops that only list later occupants (Erie text naming Shawnee, Mingo, and Wyandot as later users of the valley) were not linked.
- People who appear only inside their own article were not given an alias, because nothing else would light up.

## UI surfaces

| Surface | Related aside | In-text person links |
|---|---|---|
| History (timeline) story reader | Already shipped (#150) | Body, and now the summary line when it is shown |
| Stories page reader | Already shipped (#150) | Body, and now the summary line when it is shown |
| Map popup (home map, History map pin, Stories map pin) | New. Shown whenever `related[slug]` is non-empty, including when the popup body is only the short summary | New, on the popup text |
| History-layer marker popup | New, when that marker’s id matches a story in `stories-locations.json` | New, on the marker text |

List cards stay plain summaries. A related block under every row would stretch the list, and the Stories cards are buttons, so a link inside them would be invalid. Opening the story, or the map pin, is where the links appear.

## How to test

1. Stories → **Wyandot on Kentucky’s northern frontier**. The aside should list Blue Licks, Bryan Station, John Todd, and Stephen Trigg. “John Todd” and “Stephen Trigg” in the body should be dotted links.
2. Stories → **Col. John Hardin of Pleasant Run**. Aside should include Benjamin Logan, the Mascouten story, Kickapoo, and the Wea / Scott 1791 raid. “Benjamin Logan” in the last sentence should link.
3. Map → open **Stanford from St. Asaph** (or its History pin). The popup should show the related aside (Benjamin Logan, John Floyd) even though the pin text is the short summary. “Benjamin Logan” / “John Floyd” link when those names are in the shown text.
4. Home hero: the Tellico quote should read through “Return J. Meigs…”, not stop at “Return J.”
