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
