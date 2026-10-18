# Kentucky History Drive: Site Charter

One shared strategy for every bot that works on kyhistorydrive.com (repo `shannonsnowden/kyhistorydrive`, deployed from `main` by AWS Amplify). Status: draft, October 2026. Facts below come from the repo and the live site.

## Mission
Our mission: get people interested in Kentucky history, show them where it happened on the map, and help them plan a drive to go see the historic sites. Every feature and story decision serves that path from story to place to drive. For example, story links open with the map visible on the story's pin, and each story points to a nearby drive.

## Portraits and images
Put faces to names: every character gets a bio portrait. Real photographs are used as-is. Anyone without a real photograph gets a realistic AI portrait, modeled on an existing drawing, engraving or painting where one exists, labeled AI and credited 'AI illustration · Kentucky History Drive'. When no known likeness exists, the credit adds '; no known likeness exists' ('AI illustration · Kentucky History Drive; no known likeness exists'). Each approved portrait is that character's canonical face, reused across stories, images and mini-doc videos; don't make new versions. Story Studio keeps the reference sheets. The Photos sidebar shows a different topic image, never the portrait.

- Never credit Story Studio on the site. The check-no-studio-credit build check enforces this and fails the build if a Studio credit appears in the built pages or data.
- The 36px story headshots carry no visible AI badge; their AI status is stated in the alt text only.
- Landscape story figures (16:9 culture AI illustrations, `.story-figure`) are an exception to the centered 180–200px mobile block: under 560px they are centered at min(360px, 100%) wide, because a 200px-wide 16:9 scene is only about 112px tall and unreadable. Portraits keep the 180–200px rule. On wider columns they float right at min(360px, 50%). The caption (AI note and credit) is at least 0.8125rem.
- The site never links to the private research repository. Refer to it in words (for example, 'our research notes'), never with a link.

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
- **Sourcing**: Primary or official sources first: [history.ky.gov](https://history.ky.gov) (KHS markers), then state and federal archives (KDLA, NARA, LOC/Chronicling America), then HMdb, then peer-reviewed or reputable published histories. Encyclopedia pointers: Grokipedia first, Wikipedia only when Grokipedia has no suitable article (Shannon, 2026-10-18). An encyclopedia page is a pointer, never the only source for a fact; primary, scholarly and agency sources still come first. Link the page for the specific item, never a homepage.
- **Claims**: Every factual claim a reader could question (dates, names, numbers, quotes) traces to at least one linked source in Learn more.
- **Disagreement**: When sources disagree, the story says so plainly.
- **Oral history**: Family tradition and oral history are labeled as such.
- **Living people**: no personal details.
- **Cite this story**: use the Chicago or MLA format with author or "KY History Drive", title, site, URL, published date, last revised date and accessed date. The published date comes from the real git first-commit date. Never invent dates; when there's no reliable date, show only "Last revised".
- **Paragraphs**: 2 to 4 sentences. No walls of text.
- **Photos**: Use real archival photos when they exist; use AI images or illustrations where none exist or where they serve the story better. Every AI image is visibly labeled "AI illustration" with a credit, and is never passed off as a real photo. (Approved by Shannon 2026-10-11.) AI images may show realistic faces of real historical people; this replaces the earlier no-photoreal-likeness rule. Such images must always be labeled "AI illustration" and credited, with no exceptions (Shannon, 2026-10-12). When a photo is not from the story's period, caption it as a "later view".
- **Fairness** (Shannon, 2026-10-11): Every story must be fair to the Shawnee and to every people it covers. Present Native nations, settlers and all groups with balance, using their own perspectives and names where sources allow, and avoid one-sided framing.
- **Native nations**: every new story gets a territory map, or a tag only when the source is oral tradition. Archaeological cultures get a shape only when sources place them in an area. Timeline map pages exist only when the map shows real change over time. Never remove panel layers. Outside tribal review was skipped; stories rely on cited sources.
- **Years**: event or occupation years only, never dig, WPA, NRHP or study dates. BCE years are stored as negative numbers. Use culture defaults when there's no date.
- **Source links**: every source link must return 200. No other AI-generated pages, and no search-results pages. Encyclopedia pointers: Grokipedia first, Wikipedia only when Grokipedia has no suitable article (Shannon, 2026-10-18). An encyclopedia page is a pointer, never the only source for a fact; primary, scholarly and agency sources still come first. Soften or remove unsupported claims.
- **No duplicates**: no repeats of stories already on the site. Swap the story and flag it.
- **County, tags and era**: set County explicitly, and set tags and era by hand.
- **Cultures vs tribes**: archaeological cultures are not tribes. Theme-only topics get no pin.
- **Homepage**: homepage copy stays evergreen.
- **Pin coordinates**: prehistoric pins rounded to 2 decimals; restricted (confidential) sites generalized further to 0.1° in every output (data, JSON-LD, GPX/KML, waypoints).

## Voice
Plain and specific. Place first ("On the Green River's Big Bend in Butler County…"), dates and site numbers up front, short sentences. Call areas approximate when they are approximate. No hype.

## Visual system
**Palette: green and amber, final (Shannon, 2026-10-11).** Navy and gold stay only in the seals. The UI never uses seal navy.

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

**Images:** Prefer real archival photos when they exist; AI images or illustrations are allowed when none exist or when they serve the story better. Every AI image is visibly labeled "AI illustration" with a credit, and is never passed off as a real photo. AI images may show realistic faces of real historical people (Shannon, 2026-10-12), always labeled "AI illustration" and credited. Served from the repo as AVIF with a WebP fallback, using `srcset` and `width`/`height` set (no CLS), with `loading="lazy"` below the fold. Out-of-period photos are captioned "later view". If there's no good match and no labeled illustration, there's no image, never a filler.

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
7. Photos are archival when available; AI images are labeled "AI illustration", credited and relevant (the right place and period), including any realistic likeness of a real historical person.
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
- **SEO**: prerendered pages, canonical URLs, sitemaps (including image and video sitemaps, plus RSS), and JSON-LD (Organization, Article, Place, BreadcrumbList, ImageObject, ItemList/Place, VideoObject). Meta descriptions are whole sentences of 70–160 characters. Prehistoric pins rounded to 2 decimals; restricted (confidential) sites generalized further to 0.1° in every output (data, JSON-LD, GPX/KML, waypoints). Account pages are `noindex`.
- **AI visibility**: `robots.txt` allows GPTBot, PerplexityBot, ClaudeBot and Google-Extended. Each story and route page opens with a 1–2 sentence plain answer in prerendered text. Route pages also list their stops in text (modern town and county), because assistants quote text and can't read map art. Titles and H1s match how people ask ("Warriors' Path in Kentucky: Route Map and Stops"). The homepage, the story archive, and a `/routes/` index link to every story and route page in crawlable HTML. The sitemap carries `lastmod`. About names the publisher (Kentucky History Drive / Shannon Snowden) to match the Organization JSON-LD, so answers stop calling the site "unverified." When sources disagree, the page states the range and which source says what (e.g., Mary Ingles: 500, 600, or 800 miles), because a sourced explanation of the dispute is what assistants cite. AI Search Visibility rechecks the buyer and route question set after major releases and reports to Chief of Staff.

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
| SEO & AEO Desk | Agreed (with edits, 2026-10-11) |
| Security Watch | Agreed (with edit, 2026-10-11) |
| AI Search Visibility | Agreed (with edits, 2026-10-18) |
| KY History | Agreed (with edits, 2026-10-11) |
| Story Studio | Agreed (with edits, 2026-10-11) |
| Research Bot | Agreed (with edits, 2026-10-11) |
| KY Website Editor | Agreed (author, 2026-10-11) |

## Team workflow: Superpowers skills
Standing rule from Shannon, October 18, 2026: the Superpowers skills plugin is part of everything the web team does.
- **brainstorming** and **writing-plans** before features (for example, the animated route map).
- **test-driven-development**.
- **systematic-debugging**.
- **requesting-code-review** and **receiving-code-review**.
- **verification-before-completion** before anything is called done, Merged-and-Live, or Live. Never mark a card Live without checking the actual live build or page.
- Do NOT adopt **using-superpowers**.

Chain of command is unchanged: web-team bots report to KY Website Editor, who reports to Chief of Staff, who talks with Shannon.
