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
- **Photos**: real photos only, licensed and attributed. No AI images presented as photos; Story Studio illustrations allowed when labeled and credited. (pending Shannon's OK) When a photo is not from the story's period, caption it as a "later view".
- **Fairness** (Shannon, 2026-10-11): Every story must be fair to the Shawnee and to every people it covers. Present Native nations, settlers and all groups with balance, using their own perspectives and names where sources allow, and avoid one-sided framing.
- **Native nations**: every new story gets a territory map, or a tag only when the source is oral tradition. Archaeological cultures get a shape only when sources place them in an area. Timeline map pages exist only when the map shows real change over time. Never remove panel layers. Outside tribal review was skipped; stories rely on cited sources.

## Voice
Plain and specific. Place first ("On the Green River's Big Bend in Butler County…"), dates and site numbers up front, short sentences. Call areas approximate when they are approximate. No hype.

## Visual system
**Palette decision (Shannon, Oct 2026): green and amber stay.** Navy and gold appear only in the seals. The UI never uses seal navy.

**Color tokens** (`src/styles.css`; use the variables, never raw hex):
| Token | Role | Dark | Light |
|---|---|---|---|
| `--bg` | page | #101812 | #F3EAD8 |
| `--panel` | cards | #1A241C | #FFFDF6 |
| `--surface` | insets, image wells | #141C16 | #E8DFCC |
| `--text` | body | #F3EAD8 | #1A241C |
| `--muted` | secondary text | #A8B59C | #52604C |
| `--heading` | headings | #E8D5A8 | #3D2A12 |
| `--accent` | links, CTAs, hover borders | #C9893A | #85500F |
| `--accent-deep` | pressed or hover fill | #8B5A2B | #6E4214 |
| `--ink-on-gold` | text on accent fills | #1A140C | #FFFDF6 |
| `--line` | borders | #2E4034 | #D3C4A6 |
| `--chip` / `--chip-active` | chips | #243628 / #C9893A | #E7DFCC / #C9893A |
| `--focus-ring` | focus outline | #F6EDD8 | #3D2A12 |

**Contrast:** body text and UI text are WCAG AA at minimum (4.5:1, or 3:1 for 18.66px bold / 24px and up). Focus rings and control borders are 3:1. A new token pair must have its ratio checked in the PR.

**Themes:** light and dark are equal citizens (`html[data-hp-theme]`). Ship and screenshot both.

**Type:** system sans (`"Segoe UI", system-ui, -apple-system`) for UI and body text. Bookman serif stack only on territory maps. De-facto scale: 0.75 / 0.82 / 0.92 / 1 / 1.15 / 1.35 to 1.8 (clamp) / 2 to 3.4rem (clamp). Body line-height is 1.45 to 1.5. Don't add new sizes.

**Spacing:** steps of 0.35 / 0.5 / 0.75 / 1 / 1.25 / 1.75rem. Section gutters are `clamp(1.25rem, 5vw, 4rem)`.

**Cards:** `background: var(--panel)`, `1px solid var(--line)`, `border-radius: 14px` (12px for story-list cards, 8px for controls, 999px for pills). No resting shadow. On hover: `border-color: var(--accent)`, and the shadow is `0 0 0 1px var(--accent), 0 8px 22px rgba(0,0,0,.28)` (dark) or `0 8px 22px rgba(40,28,12,.08)` (light). Hover never moves the layout.

**Focus:** `outline: 3px solid var(--focus-ring); outline-offset: 2px` on every interactive element. The hero uses the cream `#F6EDD8` ring on photos. Never remove an outline without a replacement.

**Tap targets:** at least 44×44px. Primary CTAs are 48px tall.

**Motion:** transitions only (150 to 350ms, ease), with no autoplay movement that can't be paused. Under `prefers-reduced-motion: reduce`, transitions and transforms are off, and state shows through color and border only.

**Images:** real photos only, licensed and credited on the page. No AI images. Served from the repo as AVIF with a WebP fallback, using `srcset` and `width`/`height` set (no CLS), with `loading="lazy"` below the fold. Out-of-period photos are captioned "later view". If there's no good match, there's no photo, never a filler.

**Header and seal:** three seals rotate (`khd-logo`, `-c`, `-c2`). The seal is picked before first paint. It gets a 2px gold border, a navy outline on the light header and a dark outline on the dark header. The header stays one row from 701 to 1400px and is opaque on phones (including the open menu). The seal is never recolored, stretched or used on its own as a UI color source.

**Maps:** MapLibre with the CARTO Voyager basemap. Each layer has its own pin color (Markers #E87722). Territory maps are SVG on parchment #EFE3C4 with ink #2A1D10 and rivers #8FBDD6. Approximate areas are labeled approximate. Route maps use the parchment house style.

**Route maps (Story Studio):** the site palette, plus a phone-specific art file (not a downscale) with labels about 24px tall at 390. A legend and credit line go under the map on the page. Light and dark variants. No labels clipped or overlapping.

**House illustration style** (owned by Story Studio; full rules in Story Studio's `HOUSE-STYLE.md`):
- **Paintings:** American genre painting of 1840–1910 (George Caleb Bingham, Eastman Johnson) for most scenes, with Leutze-style heroic history painting for the peak, dramatic moments. Each painting matches the emotional tone of its beat. Content is PG for YouTube: violence is implied (smoke, fallen or covered figures), never gory. Every draft and replaced painting stays in the shared library; none are deleted.
- **Video motion:** 2.5D "living paintings". Frames are static by default, and smoke, water, fire, leaves, sky and snow move inside the painting. Camera moves are used only to show action (a run, a flight, a crossing) or as a slow push-in on a dramatized interview.
- **Maps:** antique parchment house maps with real geography (Natural Earth rivers, terrain relief). In video the frame is fully static; only the red route line draws itself, with stop dots and labels appearing. Line key: solid red = route (approximate on land), red dotted = conjectural segment, lighter red dashes = branches. Web exports: 1600 and 3840 light, a dark-panel variant, 780 px phone art, and zoom files (PNG/WebP/AVIF).
- **Sound and narration:** ambience comes only from real CC0 or public-domain field recordings, matched to the scene and credited. Narration is natural and continuous, one read per scene with no phrase-stitching, and emphasis comes from punctuation only.
- **Video layout:** title card, then a disclaimer that dramatized scenes are included, then the story. All credits and citations go at the end, opening with "Produced and Directed by Shannon Snowden". Dramatized interviews are labeled with a disclaimer card, a "(dramatized)" lower third (a persistent DRAMATIZED tag in vertical cuts), italic subtitles and a credits note.
- Nothing from Story Studio is posted publicly without Shannon's OK.

**Design review checklist (Critiquito, every visible PR):**
1. Screenshots at 1440, 1280 and 390, light and dark.
2. Tokens only, and every new color pair checked for AA.
3. Focus ring visible. Tab order makes sense, with no duplicate tab stops.
4. Targets 44px or larger. `aria-pressed`/`aria-expanded` on toggles.
5. Reduced-motion checked.
6. No layout shift from images, ads or the signed-in UI.
7. Photos are real, credited and relevant (the right place and period).
8. Header on one row at 1280. The phone menu is opaque.
9. Copy fits without pushing the primary CTA below the first screen on a 390 phone.

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
| Critiquito | Agreed (with edits, 2026-10-11) |
| SEO & AEO Desk | Pending |
| Security Watch | Agreed (with edit, 2026-10-11) |
| AI Search Visibility | Pending |
| KY History | Pending |
| Story Studio | Agreed (with edits, 2026-10-11) |
| Research Bot | Pending |
| KY Website Editor | Agreed (author, 2026-10-11) |
