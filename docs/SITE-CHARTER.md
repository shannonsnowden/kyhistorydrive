# Kentucky History Drive: Site Charter

One shared strategy for every bot that works on kyhistorydrive.com (repo `shannonsnowden/kyhistorydrive`, deployed from `main` by AWS Amplify). Status: draft, October 2026. Facts below come from the repo and the live site.

## Audience
Kentuckians, road-trippers and history readers who want to know what happened where they are standing. Many read on a phone in the car or at a marker, so mobile comes first.

## Purpose
Find Kentucky Historical Society markers on a free map and read a new Kentucky history story every day. Tagline: "History is all around us."

## Content pillars
- **Stories**: 230 story pages under `/stories/`, each linked to the timeline and the map.
- **Map** (MapLibre): Markers, History pins, Museums, National, War Sites, Good Eats, Covered Bridges, Industry (mills), Newspapers, Parks, Cemeteries, Distilleries and Caves, plus Native nations and archaeological cultures shown as approximate areas. Public caves are pinned; other caves show by county only.
- **Timeline**: filter by era and year range.
- **Story archive**: "Browse all stories", newest daily stories first.
- **Daily story packs**: "Today's stories" in the header.
- **Resources**: the "Related Kentucky history sites" hub and the Resources view. Also route maps (`/routes/`) and `/videos/`.
- **iPhone app (coming soon)**: OTA data from `public/data/app/ky-history-manifest.json`. Bump `data_version` when that data changes.

## Standards
- **Sourcing**: history.ky.gov first, then HMdb, then Wikipedia. Link the page for the specific topic, not a homepage.
- **Paragraphs**: 2 to 4 sentences. No walls of text.
- **Photos**: real photos only, licensed and attributed. No AI images. When a photo is not from the story's period, caption it as a "later view".
- **Native nations**: every new story gets a territory map, or a tag only when the source is oral tradition. Archaeological cultures get a shape only when sources place them in an area. Timeline map pages exist only when the map shows real change over time. Never remove panel layers.

## Voice
Plain and specific. Place first ("On the Green River's Big Bend in Butler County…"), dates and site numbers up front, short sentences. Call areas approximate when they are approximate. No hype.

## Visual system
- **Brand**: three seals in `public/brand/` rotate in the header (`khd-logo`, `-c`, `-c2`, chosen in `index.html`). They use Kentucky flag navy (about `#002F6B`) and gold (about `#D6AE37` to `#F8C028`) on cream or black, with "Kentucky History Drive", "History is all around us." and a road, a marker and crossed muskets.
- **UI colors** (`src/styles.css`, "Bluegrass green, thoroughbred leather, bourbon amber"). Dark theme: bg `#101812`, panel `#1A241C`, text `#F3EAD8`, accent `#C9893A`, heading `#E8D5A8`. Light theme: bg `#F3EAD8`, text `#1A241C`, accent `#9A5F1C`, heading `#3D2A12`. Note that the UI is green and amber, not the seals' navy and gold.
- **Type**: system sans (`"Segoe UI", system-ui, -apple-system`). Territory maps use a Bookman serif stack (`"Bookman Old Style", "URW Bookman", C059, Georgia`), set in uppercase with letter spacing.
- **Map style**: MapLibre GL with the CARTO Voyager basemap (OSM data). Each layer has its own pin color (Markers `#E87722`). Territory maps are SVG on parchment (`#EFE3C4`) with ink `#2A1D10` and rivers `#8FBDD6`.
- **House illustration style**: owned by Story Studio, to be filled in.

## Navigation
Header: logo (goes Home), search, Today's stories, Home, Map, Timeline, About, iPhone app (coming soon), and a light/dark toggle. Story pages: breadcrumb, "Learn more" sources, related stories, "Open on the timeline" and "Open on the map". Footer: About, Videos, Route maps, Privacy.

## Quality bar
Fast first paint (ads and maps load after it). axe: 0 violations. Check at 1440, 1280 and 390 px wide, light and dark; keep 1280, because the map gap bug only shows there. No broken links. Every map pin opens and sits in the right place. Security headers and CSP are required, and Security Watch reviews every site PR.

Every check script in `npm run build` must pass:
- prerender
- GA4 tag on every page
- map canvas overlap and gap (the browser pass is skipped on Amplify, which has no Chrome, so run it locally)
- contact address not in the HTML
- whole-sentence story meta descriptions
- paragraph-split word-identity check
- RSS validation, once #214 lands

## Ads, SEO and AI visibility
- **Ads**: AdSense (`ads.txt`). Slots are reserved on home, explore and sidebar, and stay off unless `VITE_ADS_ENABLED` is set. They never block content or the map, and reserved slots must cause no layout shift. `VITE_ADS_ENABLED` stays unset until Google approves the site.
- **SEO**: prerendered pages, canonical URLs, sitemaps, and JSON-LD (Organization, Article, Place, BreadcrumbList).
- **AI visibility**: `robots.txt` allows GPTBot, PerplexityBot, ClaudeBot and Google-Extended. Clear sourcing and dates make stories easy to cite.

## Review pipeline
Engineer Bot builds, then Critiquito reviews design, then SEO & AEO Desk reviews search, then Security Watch reviews security, then KY Website Editor does the final review, then Shannon OKs the merge.
- Security Watch is the security specialist: it does a security review of every site PR (especially auth and profiles) and regular site monitoring.
- There are no Amplify PR previews. Reviews use agent screenshots or a gh-pages preview, then live checks after the deploy.
- KY Website Editor and KY History merge their own daily content packs. Those are exempt from this pipeline unless they change templates.
- Never commit secrets.

## Sign-off
| Bot | Status |
|---|---|
| Lingxi's Engineer Bot | Agreed (with edits, 2026-10-11) |
| Critiquito | Pending |
| SEO & AEO Desk | Pending |
| Security Watch | Agreed (with edit, 2026-10-11) |
| AI Search Visibility | Pending |
| KY History | Pending |
| Story Studio | Pending |
| Research Bot | Pending |
| KY Website Editor | Agreed (author, 2026-10-11) |
