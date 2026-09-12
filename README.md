# kyhistorydrive.com

Web companion to the **KY Markers Drive** iOS app — Kentucky Historical Society markers on an open-source map, plus **Stories** and a filterable **Timeline** built from daily Kentucky History morning briefs.

## Stack

- [Vite](https://vitejs.dev/) static site
- [MapLibre GL JS](https://maplibre.org/) (no Google Maps / MapKit JS)
- [marked](https://marked.js.org/) for story markdown
- Basemap: CARTO Voyager raster (OSM data) — works locally without an API key
- Optional overlay: [OpenHistoricalMap](https://www.openhistoricalmap.org/) tiles
- Marker data: GeoJSON derived from `ky-markers-drive` `data/markers.phase1.json`
- Stories: `public/content/stories/*.json` + `public/content/stories.json` index

## Routes (hash)

| Hash | View |
|------|------|
| `#map` | Marker map (default) |
| `#timeline` | Era + year-range filtered timeline |
| `#stories` | Story list |
| `#story/<slug>` | Story detail |
| `#about` | About |
| `#app` | iOS app |

Nav: **Map | Timeline | Stories | About | App**

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

## Build

```bash
npm run build
npm run preview
```

`npm run build` regenerates `public/content/stories.json` then runs Vite. Output is in `dist/` for Amplify.

## AWS Amplify + Route53

1. Amplify Hosting → **Host web app** → connect GitHub repo `shannonsnowden/kyhistorydrive`
2. Build settings use root `amplify.yml` (`npm ci` → `npm run build`, artifact `dist`)
3. When **kyhistorydrive.com** is live in Route53, Amplify → Domain management → add `kyhistorydrive.com` (+ `www` if desired)
4. Amplify will ask for Route53 DNS records (or provide CNAME/ALIAS to paste into the hosted zone)

No secrets required for the default OSM/CARTO basemap. If you later switch to MapTiler/Stadia vector styles, add the key in Amplify environment variables and wire `VITE_MAP_STYLE_URL` in `src/main.js`.

## Data attribution

Marker inscriptions and locations: Kentucky Historical Society / [history.ky.gov](https://history.ky.gov/markers). Map data: © OpenStreetMap contributors; CARTO; OpenHistoricalMap when enabled. Morning-brief stories are authored for the KY History Drive project.

## Related

- iOS app repo: https://github.com/shannonsnowden/ky-markers-drive
