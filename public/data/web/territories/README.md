# Territory data (web-only)

Not part of the iOS app packs. The app only fetches `/data/app/*`.

To add a nation (no code change):
1. Add `<nation>-<story>.json` here (same shape as `chickasaw-hunting-grounds.json`: `nation`, `eras[]`, `geojson` features with `properties.id`, `sources[]`, `overlapNote`, `timeline`, `mapLabelPos`).
2. Add one entry to `index.json`: `id`, `name`, `color` (pick the next unused Okabe-Ito color), `slugs` (story slugs that open this nation highlighted), `ref`, `extentFeature` (feature id drawn on the main map), `yearStart`, `yearEnd`, `confidence`, optional `note`.
3. Add the small `territory` pointer to the story JSON (for the story card).

Palette (Okabe-Ito, colorblind-safe): #D55E00 vermillion, #0072B2 blue, #009E73 green, #CC79A7 pink, #E69F00 orange, #56B4E9 sky, #F0E442 yellow. No empty strings anywhere.

## Optional fields for multi-era nations (added in batch 1)
- `baseRef`: base map JSON (default `_poster-base-ky.json`, the Chickasaw window). `_base-ohio-valley.json` is the wider window (Ohio Valley to the Carolinas).
- `view.{full,narrow,card}`: SVG viewBox per layout. `pal`, `fadeSouth`, `fadeYears` (0 = hard cut between eras), `pins`.
- `stories[slug]`: per-story displayed years/label when one file serves several stories; `startEra[slug]`: era shown first.
- Era `layers[].style`: `soft`, `solid`, `hatch`, `line`, `dash`, `point`. Geometry may be a `GeometryCollection` (polygons fill, lines stroke). Era `notDrawn: {map, tag}` shows an "unknown, not drawn" note.
- Index entry `mapNote`: one line shown under the nation in the map legend. `extentFeature` may be a `GeometryCollection` (main-map/muted shape).

### Main-map parts (`mainMap`, optional)
`{fill, area, general, lines, outside, points, hatch, labels:[{text,at}]}`; each part names a feature id. `fill`/`area` = filled polygon (opacity 0.5; `hatch:true` makes `area` a diagonal-stripe pattern so it stays readable over another nation's solid fill), `general` = soft low general-area tint with dashed edge, `lines` = solid lines inside Kentucky, `outside` = dashed lines outside Kentucky (never filled), `points` = MultiPoint. Era field `noBoundary:true` changes the tag to "Approximate location" (presence-only nations).
