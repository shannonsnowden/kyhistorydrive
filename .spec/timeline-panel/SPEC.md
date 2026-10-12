# Story Timeline panel — build spec (kyhistorydrive.com)

Status: spec only, for a **preview build by Engineer Bot**. No repo changes have been made. Deliver it as a draft PR plus Amplify preview and screenshots. **Never use gh-pages.** Normal merge only, after Shannon's OK via CoS.
Repo read at `main` f1a9299 (12 Oct 2026).

## 1. What World History Encyclopedia does (studied 12 Oct 2026)
The pages studied were `/Battle_of_Hastings/` (8 entries) and `/Mongol_Empire/` (103 entries), at 1280 and 390. Screenshots are in `ref/`.

| Aspect | WHE behaviour |
|---|---|
| Placement | Desktop: right sidebar `<aside class="column_300px">`, 300px wide at x=910. Starts beside the article top (y≈529), not sticky. Phone (≤~768): the sidebar drops below the whole article, footnotes and licence (Hastings y≈21,900 of 25,500px), so few readers will see it. |
| Structure | `<h2>Timeline</h2>`, then "Add Event" and "Visual Timeline" buttons, then `<ul id="time_list">` with one `<li class="timeline_entry">` per event: `<div class="date">` followed by a one-sentence event text with inline links to other articles. |
| Count | All entries tagged to the topic: 8 on Hastings, 103 on Mongol Empire (≈13,000px tall). There's no cap, no "before/after" framing and no highlighted current item. |
| Dates | Bold 20px Karla in #333 above the text. Formats include "6 Jan 1066", "Aug 1066", "c. 1162 - 1227" and "1206 - 1368". |
| Item style | 16px text with links in brand red. A 1px dashed #e3e3e3 bottom divider, 12px bottom padding, on a light grey panel. |
| Phone | Same list at full width (360px). It isn't collapsible. |

**Keep:** the bold date above a one-line description, the plain `<ul>`, quiet dividers, and the sidebar spot on desktop.
**Improve:** cap at about 8 items centred on this story, highlight the current story, put it near the top on phones (collapsible) instead of the very bottom, make the whole row a ≥44px link, and add proper aria.

## 2. Data it uses (existing only, no new content)
Source: `public/content/stories.json` → `stories[]` (235). Fields that are always present: `slug, title, summary, yearStart, yearEnd, era, tags[], lat, lon, mapConfidence, matchedPlace`. Optional fields: `county` (140), `photo`, `territory`.
- `era` takes one of: prehistoric, native, revolution, frontier, early-commonwealth, modern, other.
- 14 stories have `yearStart == null`. Exclude those as candidates. A null-year current story gets no panel.
- Broad tags, which don't count as a "theme" match: `kentucky`, the era names, `native-history`, `other`. Use the existing `BROAD_RELATED_TAGS` and `relatedTagSets()` in `src/story-tools.js`.
- Specific tags, which count as themes: frontier-war, archaeology, town-founding, salt, geology, bourbon, treaty, transport, trail-of-tears, civil-war, and so on.
- Map pins: `storyPlaceHash({historyId, slug, lat, lon})` in `src/main.js` gives `#map/history/<id>` or `#map/stories/<slug>`, or null. Markers use `markerMapHref(id)`, which gives `/#map/markers/<n>` (`public/data/markers.geojson`, 1,883 of 1,921 with `yearStart`).
- Story pages: static `/stories/<slug>/` (prerender) and in-app `#timeline/<slug>` (`storyShareHash`).
- Year labels: reuse `formatYearRange(start,end)` from `src/main.js` (handles BCE/CE). Move it into `story-tools.js` if the prerender needs it.

## 3. Selection algorithm (new pure function in `src/story-tools.js`)
`pickTimelineEvents(story, allStories, markers?, {perSide = 4, max = 9})` returns `{before[], current, after[]}`.
1. **Anchor year** `y = yearStart ?? yearEnd`. For each candidate, take `cy = yearStart ?? yearEnd` and skip it if null.
2. **Relevance score**, where the candidate must score > 0:
   - +3 per shared *specific* tag
   - +2 for the same county, using `sameCounty()`
   - +1 for the same `era`
   - +1 if within 40 mi (`relatedMiles()`), which works as the "region" signal
3. **Split:** `cy < y` goes to before, `cy > y` to after. When `cy == y`, the earlier `yearEnd` goes before, then title order.
4. **Rank each side** by score (high first), then `|cy - y|` (nearest in time), then title. Take up to `perSide` (4, within the 3–5 range). If one side has fewer than 3, fill the other side, up to 8 total. Prehistoric stories, for example, often have nothing earlier.
5. **De-dupe** near-duplicate stories (the prototype found "Lawrenceburg from Kaufman's Station" twice, and Springfield twice). Drop a candidate whose `matchedPlace` matches an already-picked one, or whose normalised title shares its first 2 words and its year.
6. **Optional marker fill:** only if a side still has fewer than 3, add the nearest-in-time historical markers in the same county whose `yearStart` is within ±25 yrs. Label them "Marker" and link them to `markerMapHref`.
7. **Display order:** chronological within each side, ascending, with the current story between the two sides.
Deterministic, no network, no new data. Add a unit test next to `scripts/test-story-quick-wins.mjs`.

Prototype output, run on real data with this scoring (before de-dupe):
- *Bardstown (1780)*: George Rogers Clark 1778, Patterson builds Lexington 1779 … ★Bardstown 1780 … Elizabethtown 1780, Frankfort 1780, Lawrenceburg 1780.
- *Benjamin Logan (1775)*: Bullitt's Lick 1773, John Floyd 1774, Ann McGinty 1775 … ★ … Levi Todd 1775, Stanford from St. Asaph 1775, William Calk's journal 1775.
- *Carlston Annis (−3000)*: nothing earlier, so the after side fills: Chiggerville, Indian Knoll, Read Shell Midden, Cloudsplitter.

## 4. Markup (a11y)
```html
<nav class="story-timeline" aria-labelledby="storyTimelineH">
  <details class="story-timeline-toggle" open>        <!-- closed by default at ≤600px -->
    <summary><h2 id="storyTimelineH">Timeline</h2><span class="st-count">8 events</span></summary>
    <ol class="st-list">
      <li class="st-item"><a class="st-link" href="/stories/george-rogers-clark/">
          <span class="st-date"><time datetime="1778">1778</time></span>
          <span class="st-title">George Rogers Clark</span></a>
          <a class="st-pin" href="/#map/stories/george-rogers-clark" aria-label="Show George Rogers Clark on the map">📍</a></li>
      <li class="st-item st-current" aria-current="page"><span class="st-date"><time datetime="1780">1780 – 1788</time></span>
          <span class="st-title">Bardstown</span><span class="st-here">This story</span></li>
      …
    </ol>
  </details>
</nav>
```
- Use `<ol>`, since the list is chronological. The current item uses `aria-current="page"`, isn't a link, and carries the visible text "This story" (not colour alone).
- `<time datetime>` uses the ISO year, with a negative value for BCE.
- Item text: the story `title` only, with no invented summaries. Optionally add a 1-line `summary` clamp on desktop, using `HomepageStructure.finishedSummary`.
- Primary link: the story page. Secondary 📍 link only when `storyPlaceHash` is non-null. Marker rows: the primary link goes to the map.
- `heading` level follows the page: h2 on static pages. The reader passes `headingLevel` as `relatedAndNearbyForStory` does, and ids are sanitised like `relatedBlockHtml`.
- Focus: use the existing `--focus-ring` with a `:focus-visible` outline of 2px and 2px offset on `.st-link`, `.st-pin` and `summary`.
- `<details>`/`<summary>` give a native keyboard/AT toggle. Escape all strings with the existing `escapeHtml`/`esc`.

## 5. Placement
- **Desktop ≥901px:** right column of `.story-reader-layout` (already `1fr | 140–220px`). Put it under `.story-sidebar-photo`, or alone if there's no photo. Widen the column to `minmax(180px, 260px)` only when the timeline is present. Not sticky, because the photo is already sticky; either stop the photo's stickiness or place the timeline above the photo. Engineer Bot should pick one and screenshot it.
- **Tablet/phone ≤900px:** single column. Place it **after the story header/summary and before `.story-body`**, collapsed (`<details>` without `open` at ≤600px; JS sets `open` at ≥601px on load and resize). The summary row reads "Timeline · 8 events ▾".
- Render in both places it matters: the static prerender `/stories/<slug>/` (`scripts/prerender-pages.mjs`, so the crawlable HTML has the panel) and the in-app reader (`src/main.js` around the `story-reader-layout` template, line ~3220). Share one HTML builder in `story-tools.js`.
- Don't duplicate "Related & nearby". Pass the timeline slugs as `excludeSlugs` to `relatedAndNearbyForStory` so a story never appears twice.

## 6. Visual style (green and amber only; navy and gold only in seals)
Use existing tokens from `src/styles.css`:
| Element | Token |
|---|---|
| Panel | `background: var(--surface)`, `border: 1px solid var(--line)`, radius 12px, padding .75rem |
| Heading | `var(--heading)`, .78rem uppercase .04em, as `.story-sidebar-photo-heading` |
| Date | Bold 1rem, `color: var(--accent)` (amber #9a5f1c light / #c9893a dark), tabular-nums, on its own line above the title like WHE |
| Title | .95rem `var(--text)`, 2-line clamp |
| Divider | 1px dashed `var(--line)` between items (the WHE look) |
| Rail | 2px `var(--line)` vertical line on the left with 8px dots in `var(--muted)`, plus a 12px dot in `var(--chip-active)` for the current item |
| Current row | `background: var(--chip)`, 3px left border `var(--accent)`, "This story" pill in `--chip-active` with `--ink-on-gold` text |
| Pin button | `var(--muted)`, turning to `var(--accent)` on hover/focus |
No navy (#0b2a5b) or seal gold (#c9a227) anywhere in this component. Check light and dark contrast at ≥4.5:1 for text and ≥3:1 for the rail and dots.

## 7. Touch and phone
- `.st-link`, `.st-pin` and `summary` each have `min-height: 44px` and the pin is `min-width: 44px`. The whole row is the link hit area, with 8px or more between targets.
- At 390 and 360: full width, no horizontal scroll, the date stays on one line, and the title wraps.
- Collapsed is the default at ≤600px. The open state isn't persisted (the opposite of sessionStorage 'wide'/'split'), so it doesn't interfere with #241.
- In the in-app reader, leave the existing bottom padding for the floating bar (`80px + env(safe-area-inset-bottom)`, #241) untouched.

## 8. Protected pins (must not regress)
- The panel only *links* to pins through `storyPlaceHash`/`markerMapHref`. It **never prints coordinates or distances** in the HTML, `data-*` attributes or JSON-LD.
- Coordinates come from `stories.json`, which already holds the 0.1°-rounded values written by `scripts/apply-story-overrides.mjs`. Never read raw/override sources or `/workspace/secrets/*`.
- The map's protected deep-link zoom cap (`protected-pins.js`) still applies, because the link uses the normal hash route.
- `check-protected-coords` must pass unchanged. Add an assertion in the new unit test that the rendered panel HTML contains no `\d+\.\d{2,}` coordinate patterns.

## 9. Build and QA checklist
1. Pure `pickTimelineEvents` + `storyTimelineHtml` in `src/story-tools.js`, plus a unit test in the build chain.
2. Wire it into the prerender and the reader, with CSS in `styles.css`. No new dependencies.
3. `npm run build` is green, including `check-story-a11y` and `check-protected-coords`.
4. Screenshots of Bardstown, Benjamin Logan and Carlston Annis (no-before case) at 1280 and 390 (collapsed and open), light and dark. Amplify preview only.
5. Review pipeline: Critiquito, SEO & AEO Desk, Security Watch, then KY Website Editor, then CoS for Shannon's OK, then a normal merge and live check.

## 10. Reference screenshots (`ref/`)
- `wh-hastings-1280-timeline.png` / `-panel.png`: desktop sidebar placement and item style
- `wh-hastings-390-timeline.png` / `-panel.png`: phone, the panel at the very bottom
- `wh-mongol-1280-*.png`, `wh-mongol-390-*.png`: the 103-entry uncapped list
- `wh-*-top.png`: page tops for context
- `ky-bardstown-1280-current.png`, `ky-bardstown-390-current.png`: the current kyhistorydrive story page (full page) where the panel will go
