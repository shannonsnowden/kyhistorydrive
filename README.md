# kyhistorydrive.com

Web companion to the **KY Markers Drive** iOS app — Kentucky Historical Society markers on an open-source map.

## Stack

- [Vite](https://vitejs.dev/) static site
- [MapLibre GL JS](https://maplibre.org/) (no Google Maps / MapKit JS)
- Basemap: CARTO Voyager raster (OSM data) — works locally without an API key
- Optional overlay: [OpenHistoricalMap](https://www.openhistoricalmap.org/) tiles
- Marker data: GeoJSON derived from `ky-markers-drive` `data/markers.phase1.json`

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

Output is in `dist/` for Amplify.

## AWS Amplify + Route53

1. Amplify Hosting → **Host web app** → connect GitHub repo `shannonsnowden/kyhistorydrive`
2. Build settings use root `amplify.yml` (`npm ci` → `npm run build`, artifact `dist`)
3. When **kyhistorydrive.com** is live in Route53, Amplify → Domain management → add `kyhistorydrive.com` (+ `www` if desired)
4. Amplify will ask for Route53 DNS records (or provide CNAME/ALIAS to paste into the hosted zone)

No secrets required for the default OSM/CARTO basemap. If you later switch to MapTiler/Stadia vector styles, add the key in Amplify environment variables and wire `VITE_MAP_STYLE_URL` in `src/main.js`.

## Data attribution

Marker inscriptions and locations: Kentucky Historical Society / [history.ky.gov](https://history.ky.gov/markers). Map data: © OpenStreetMap contributors; CARTO; OpenHistoricalMap when enabled.

## Related

- iOS app repo: https://github.com/shannonsnowden/ky-markers-drive
