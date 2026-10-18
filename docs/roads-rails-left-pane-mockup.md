# Roads & Rails left pane + line labels — DESIGN MOCKUP (not for merge)

Branch: `mockup/roads-rails-left-pane` (from main d8dd26c9). No PR. Preview was built from it and served on 127.0.0.1:4317.

## Brainstorm: two layouts considered
**A. Stacked collapsible sections (accordion) — CHOSEN.** Timeline, Railroads, Highways and parkways, About this map as
`<details>` cards in the existing left column. On phones (≤900px) the Timeline card sits above the map (where the
slider lives today) and the other three follow below it.
**B. Tabs (Timeline | Lines | About)** over a single panel. Rejected: hides the slider when you look at the line list,
so you can't toggle a line and scrub years together; tabs are worse at 390 with four labels; `<details>` is
native, keyboard-accessible, works without JS, and matches the "Railroad sections" disclosure already on the page.

## Design choices
- One row per line: era-coloured swatch (same colour the map draws it), name, opening year (`*` = provisional), the
  first sentence of the existing "Railroads and parkways on this map" description, and a 44×26 switch. All / None per
  group with an "n of N shown" count. Replaces both the old section-button list and the separate facts list.
- About this map holds the intro, the provisional-dates note and the full Sources and licenses list (unchanged).
- Line labels: name placed along each open, visible line at its midpoint (falling back to 35/65/22/78%), rotated to the
  line; collisions hide the lower-priority label; line names outrank endpoint town names. Short forms: "Pkwy",
  "L&N main line", "Railroad/Railway" dropped. Rail labels amber, parkway labels green italic. Mockup uses HTML
  markers because the style has no glyphs; build-out should use a MapLibre symbol layer
  (`symbol-placement: line`, `text-allow-overlap: false`) with self-hosted glyphs.
- Timeline: min = earliest opening (1834) − 5 = 1829 (data-driven); one tick per opening, merged into a dot with a
  count when ticks would be < 9px apart (14px at 390). Ticks are buttons: hover/focus/tap shows a tooltip with
  name(s) and year(s) and jumps the slider. (Approximation; the real ticks are on the timeline branch.)
- Palette: existing green/amber tokens and era colours; seal untouched.
- Data: only names/years/descriptions already on the page and in sections.geojson. Nothing invented.

## Known gaps for build-out
- Daniel Boone row shows 1971; facts say sources disagree (1971 or 1974) — show "1971/74" + Disputed badge.
- Rows built by JS at runtime in the mockup; build-out should prerender the rows into the HTML (SEO list stays crawlable).
- scripts/check-transport-sections.mjs targets the old `details.transport-rail-details` and fails on this branch;
  rewrite it for the new sections. Full keyed build stopped there, so protected-coords checks did not run on this
  branch (preview only; nothing shipped).
- Phone: the Timeline card above the map makes the map shorter; consider collapsing the decade legend by default at 390.
- Line labels at 390 overlap county lines in places; the symbol layer will place these better.

## Screenshots
pane-1280-light.png, pane-1280-dark.png, pane-390-light.png, pane-390-dark.png (+ -full variants),
pane-1280-light-railroads-collapsed.png (Railroads collapsed, a merged tick tooltip focused),
pane-1280-dark-highways-none.png, pane-390-dark-highways-none.png (+ -full).

## v2 — Critiquito fixes (mockup only)
1. **Line labels, light mode:** each label now uses a darker variant of its own era colour, darkened in 6% steps
   until it reaches >= 4.6:1 on the darkest cream (#f3ead8), plus a 2px cream (#f6eedb) halo ring with a 3px soft edge.
   Ratios vs #f3ead8: 1830s #9a6f00 3.78 -> #886200 4.63; 1850s #a0461b 5.19 (unchanged); 1870s #5c4033 7.86 (unchanged);
   1880s #2f6b3a 5.35 (unchanged); 1960s teal #0c8599 3.64 -> #0a6e7f 4.95; 1970s lime #5c940d 3.08 -> #48740a 4.65.
   (Against the map fill #f4efe4 each is ~0.2 higher.) Dark-mode labels unchanged except the parkway label follows the new 1970s lime.
2. **Rows:** description is one truncated line with a "More/Less" button (aria-expanded) that reveals the full facts text.
   Clicking anywhere on the row toggles the line; the switch hit area is 44x44.
3. **Phones (<=900px): bottom sheet, chosen over a sticky mini-map.** The Railroads and Highways groups move into a sheet
   anchored to the bottom of the map (closed = 44px handle "Railroads and highways · 13 lines"; open = 46% of the map).
   Why: the map keeps its full size and stays live above the sheet, so you see a line appear/disappear as you toggle;
   a sticky preview would be a second, tiny map that is too small at 390 to read which line changed, and it would cost
   ~150px of vertical space permanently. The sheet is a single tap to dismiss. Build-out: drag-to-resize, Esc closes, focus management.
- **Dark 1880s vs 1970s:** 1880s #7fd18b -> #5fbf73 (deeper green), 1970s #c0eb75 -> #d9e86a (yellower lime);
  ΔE76 28 -> 41. Teal 1960s unchanged.
- **Legend:** the "target" ring near Lexington is the High Bridge marker (Cincinnati Southern, 1877) and is now in the
  key, as are the white "town where a line starts or ends" dots. The decade key is a "Map key" disclosure, collapsed by default at <=600px.
- **Lexington junction:** below zoom 8, no line label is anchored within 70px of Lexington, and those labels are placed
  last; the Lexington & Ohio label appears once you zoom in (see pane-1280-light-zoomed-lexington.png).
- **Daniel Boone:** the row reads "1971/74" with a Disputed badge, derived from the page's own facts text ("Sources disagree ... 1971 or 1974").
- Data: unchanged; only existing names, years and descriptions. Palette green/amber; seal untouched.
- Screenshots: /workspace/qa-roads-rails-pane-mockup/v2/ (1280/390 light+dark, -full, 390 sheet-open and row-toggled-off,
  1280 row-expanded light, parkway row expanded dark, Timeline collapsed, zoomed Lexington).
