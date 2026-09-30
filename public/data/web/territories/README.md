# Territory data (web-only)

Not part of the iOS app packs. The app only fetches `/data/app/*`.

To add a nation (no code change):
1. Add `<nation>-<story>.json` here (same shape as `chickasaw-hunting-grounds.json`: `nation`, `eras[]`, `geojson` features with `properties.id`, `sources[]`, `overlapNote`, `timeline`, `mapLabelPos`).
2. Add one entry to `index.json`: `id`, `name`, `color` (pick the next unused Okabe-Ito color), `slugs` (story slugs that open this nation highlighted), `ref`, `extentFeature` (feature id drawn on the main map), `yearStart`, `yearEnd`, `confidence`, optional `note`.
3. Add the small `territory` pointer to the story JSON (for the story card).

Palette (Okabe-Ito, colorblind-safe): #D55E00 vermillion, #0072B2 blue, #009E73 green, #CC79A7 pink, #E69F00 orange, #56B4E9 sky, #F0E442 yellow. No empty strings anywhere.
