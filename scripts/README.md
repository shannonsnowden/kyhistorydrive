# scripts/

## story-overrides.json (editor QA fixes that survive pack rebuilds)

Daily packs and rebuilds regenerate `stories.json`, `stories-locations.json`, the story and History GeoJSON, `ky-history.json` and the search index, which can wipe hand edits (pins, wording, county, years). `scripts/apply-story-overrides.mjs` re-applies the fixes listed in `scripts/story-overrides.json`. It runs automatically at the end of `npm run sync-app-data` and as the last data step of `npm run build` (before `build-home-preview`). It is idempotent and writes only files that change.

Add an override (keyed by story slug; `reason` and `date` are required):

```json
"my-story-slug": {
  "reason": "why", "date": "2026-10-02",
  "historyId": "id-in-ky-history.json",
  "lat": 37.53, "lon": -87.27, "county": "McLean", "yearStart": -3000, "yearEnd": -1000,
  "replace": [{ "old": "exact old text", "new": "exact new text" }]
}
```

- Use any subset of `lat`+`lon`, `county`, `yearStart`/`yearEnd`, `replace`. `historyId` is needed to also patch the History layer (`history.geojson`, `ky-history.json`, search `place:` doc); it defaults to the `historyId` in `stories-locations.json`.
- `replace` is an exact string swap run on every copy of that story (story JSON, index, GeoJSON, History, `ky-history.json`, search index). It only fires when `old` is present, so it never rewrites newer text.
- Reports `applied`, `already in place`, `stale` (story or old text gone; entry can be deleted). Exit code is non-zero only for a malformed overrides file.

```bash
npm run apply-overrides   # apply now
npm run check-overrides   # dry run; exit 2 if an override would change files (drift) or is stale
npm run test-overrides    # temp-copy tests (idempotence, re-ingest repair, stale, malformed, pin rounding)
```

Not touched: `public/data/app/search-index.json` (iOS term index), `home-preview.json` (rebuilt from stories afterwards), `markers.*`, the iOS repo. Overrides never bump `data_version`; bump it yourself when an override changes served data.

## Pin rounding for looting-sensitive sites (`scripts/pin-rounding.json`, #141)

Archaeological site pins are published generalized: tier A sites use a county-level point, tier B sites are rounded to 2 decimals (about 1 km). Those exact public values are entries in `story-overrides.json` (reason "Looting-sensitive site, public coordinate generalized (#141)"), so a rebuild or a re-ingested pack re-applies them.

`pin-rounding.json` is a generic rule that covers future daily ingests with no manual step: after the overrides, `apply-story-overrides.mjs` rounds to `decimals` (2) the pin of every story with era `prehistoric` or tag `archaeology` that has more decimals than that, in every copy (story index, locations, both GeoJSON files, History layer, `ky-history.json`, both search indexes). The step is reported as `pin-rounding: N ... rounded: slugs`. It reaches History entries through the story's `historyId` and never touches stories that are not prehistoric/archaeological.

Exempt (never rounded): `skipSlugs` / `skipHistoryIds` in `pin-rounding.json`, which holds the tier C public sites (parks, caves, towns, museums) and the already county-level sites. To exempt a new public site, add its story slug and its History id to those two lists. To generalize a new site more coarsely than 2 decimals (county centroid), add an override entry instead.

Not changed by design: roadside marker positions (`markers.geojson`, `public/data/app/markers.phase1.json`, `marker:` entries in the search indexes) and the iOS app repo.
