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
npm run test-overrides    # temp-copy tests (idempotence, re-ingest repair, stale, malformed)
```

Not touched: `public/data/app/search-index.json` (iOS term index), `home-preview.json` (rebuilt from stories afterwards), `markers.*`, the iOS repo. Overrides never bump `data_version`; bump it yourself when an override changes served data.
