# kyhistorydrive.com

Web companion to the **KY Markers Drive** iOS app — Kentucky Historical Society markers on an open-source map, plus **Stories** and a filterable **Timeline** built from daily Kentucky History morning briefs.

## Stack

- [Vite](https://vitejs.dev/) static site
- [MapLibre GL JS](https://maplibre.org/) (no Google Maps / MapKit JS)
- [marked](https://marked.js.org/) for story markdown
- Basemap: CARTO Voyager raster (OSM data) — needs `VITE_CARTO_API_KEY` (free key from https://carto.com/basemaps/apikey/)
- Optional overlay: [OpenHistoricalMap](https://www.openhistoricalmap.org/) tiles
- Marker data: GeoJSON derived from `ky-markers-drive` `data/markers.phase1.json`
- Stories: `public/content/stories/*.json` + `public/content/stories.json` index

## Routes (hash)

| Path | View |
|------|------|
| `/` | Magazine homepage (Kentucky history highlights) |
| `/#map` | Marker map |
| `/#timeline` | Era + year-range filtered timeline |
| `/#timeline/<slug>` | Story detail on Timeline |
| `/#about` | About |
| `/#app` | iOS app |
| `/home-preview` | Redirects to `/` |

Nav: **Home | Map | Timeline | About | App** (logo also goes Home)

## Develop

```bash
npm install
npm run dev
```

## Content pipeline

1. Save morning-brief plaintext to `public/content/raw-briefs/YYYY-MM-DD.md`
2. Split into stories and rebuild the index:

```bash
npm run parse-briefs   # scripts/parse-briefs-to-stories.mjs
# or just rebuild the index from existing story JSON:
npm run build-stories
```

Each brief section becomes one story JSON under `public/content/stories/` with fields:
`slug`, `title`, `publishedDate`, `summary`, `bodyMarkdown`, `yearStart`, `yearEnd`,
`era` (`prehistoric` \| `native` \| `frontier` \| `early-commonwealth` \| `other`),
`tags`, `source: "daily-brief"`, `briefDate`.

Google redirect URLs in brief bodies are cleaned to the underlying target when possible.

## iOS app data feed (quiet URL)

The iPhone app checks `data_version` and downloads layer JSON from a path that is **not** in the main nav:

- https://kyhistorydrive.com/data/app/ky-history-manifest.json
- https://kyhistorydrive.com/data/app/ky-history.json
- plus the other bundled layer files (`museums.json`, `markers.phase1.json`, `search-index.json`, …) under `/data/app/`

Source of truth is `shannonsnowden/ky-markers-drive` `data/` (especially `ky-history.json` + `ky-history-manifest.json`, which bump `data_version` on daily ingest). This site copies those files into `public/data/app/` (separate from the web map GeoJSON under `public/data/layers/`).

### Refresh after daily ingest

After ingest in **ky-markers-drive** (`python3 scripts/ingest_daily_ky_history.py`, which bumps `data_version`):

```bash
# from this repo, with GitHub auth that can read ky-markers-drive
npm run sync-app-data
git add public/data/app
git commit -m "Sync iOS app data (data_version N)"
# PR or push to main — Amplify deploys from main
```

Or copy from a local clone:

```bash
KY_MARKERS_DRIVE_DIR=../ky-markers-drive npm run sync-app-data
```

Amplify `preBuild` also runs `sync-app-data`. If Amplify Hosting has env var `KY_MARKERS_DRIVE_GITHUB_TOKEN` (a PAT/fine-grained token with **read** access to `ky-markers-drive`), each site deploy pulls the latest `main` even if git copies are a commit behind. Without that token, the committed `public/data/app/` files are what go live — so the copy+commit step above is the reliable daily path.

`customHttp.yml` sets short CloudFront cache (`max-age=0`, `s-maxage=60`) and CORS (`Access-Control-Allow-Origin: *`) on `/data/app/*.json` so version bumps are not stuck behind Amplify’s default 1-year CDN cache. Native iOS URLSession does not need CORS; it is there for completeness.

## Build

```bash
npm run build
npm run preview
```

`npm run build` regenerates `public/content/stories.json` then runs Vite. Output is in `dist/` for Amplify.

## AWS Amplify + Route53

1. Amplify Hosting → **Host web app** → connect GitHub repo `shannonsnowden/kyhistorydrive`
2. Build settings use root `amplify.yml` (`npm ci` → `npm run sync-app-data` → `npm run build`, artifact `dist`). Optional env: `KY_MARKERS_DRIVE_GITHUB_TOKEN` to pull iOS JSON at deploy time. Cache/CORS for `/data/app/*.json` is in `customHttp.yml`.
3. When **kyhistorydrive.com** is live in Route53, Amplify → Domain management → add `kyhistorydrive.com` (+ `www` if desired)
4. Amplify will ask for Route53 DNS records (or provide CNAME/ALIAS to paste into the hosted zone)

Set `VITE_CARTO_API_KEY` in Amplify Hosting → Environment variables (and locally in a gitignored `.env`), then redeploy. Without it, CARTO serves an “API key required” watermark. If you later switch to MapTiler/Stadia vector styles, also set `VITE_MAP_STYLE_URL`.

## Magazine homepage (`/`)

`/` is the magazine homepage: evergreen Kentucky history highlights (no “this morning” / calendar-date kickers). Map stays one click away at `/#map`. Old `/home-preview` URLs redirect or alias to `/`.

Daily story highlights come from the same KY History morning brief that feeds Timeline:

1. Save the email as `public/content/raw-briefs/YYYY-MM-DD.md`
2. `npm run parse-briefs` writes `public/content/stories/<slug>.json` and rebuilds `stories.json`
3. `npm run build-home-preview` (also part of `npm run build` / Amplify) reads the newest `briefDate`, keeps morning-email order, attaches attributed photos (Wikipedia, Wikimedia Commons, or `historic-photos.json`), and writes `public/content/home-preview.json`

The homepage loads that pack, then re-checks `stories.json` in the browser. If a newer `briefDate` is already live, it fetches those story files and Wikipedia thumbnails so the homepage can update on the same deploy even if the pack step was skipped. If the latest feed is empty, the last baked pack is the fallback.

Stories are presented as evergreen highlights. The feed still refreshes from the newest `briefDate`; the UI does not label them as “this morning’s email” or show the ingest calendar date.

Photos are credited on the page (Wikipedia / Commons / ULPA / Historypin, etc.). Layer highlight cards use curated Commons / HABS-LOC thumbs vendored under `public/content/photos/layers/` (catalog: `scripts/layer-photo-curated.json`) so every “Explore a layer” card has a same-origin thumbnail plus a map deep-link — not a Wikimedia hotlink or a text-only fallback. Daily highlights use the same pattern under `public/content/photos/stories/` (`scripts/story-photo-curated.json`).

## Data attribution

Marker inscriptions and locations: Kentucky Historical Society / [history.ky.gov](https://history.ky.gov/markers). Map data: © OpenStreetMap contributors; CARTO; OpenHistoricalMap when enabled. Morning-brief stories are authored for the KY History Drive project.

## Related

- iOS app repo: https://github.com/shannonsnowden/ky-markers-drive
