# v2 Phase 1: Unified Story Page & Site Chrome Implementation Plan (#336)

> **For agentic workers:** Follow `writing-plans` -> `test-driven-development` -> `verification-before-completion` (do NOT use `using-superpowers`). Target branch: `v2` (never `main`). Build only Phase 1 (#336); Phases 2–6 stay held.

**Goal:** Ship the unified story page at `/stories/<slug>/` based on approved mockup v2 (`items 86 + 89`), build-time `/stories/<slug>/story.md` export, print stylesheet (`src/story-print.css`), widened coordinate-scan security gate (`scripts/check-protected-coords.mjs`), shared header & fuller footer across all pages, and Phase 1 SEO/JSON-LD/sitemap/data fixes.

**Architecture:**
- **Security Gate (`scripts/check-protected-coords.mjs` + `scripts/test-protected-coords.mjs`):**
  - Scan `.html`, `.js`, `.mjs`, `.cjs`, `.json`, `.geojson`, `.xml`, `.rss`, `.atom`, `.txt`, `.md`, `.svg`, `.css`, `.kml`, `.gpx`, `.webmanifest`, `.vtt`, `.map`, plus `pdftotext` output on any `.pdf` in `dist/`.
  - Allowlist known binary/font/archive extensions (`.png`, `.jpg`, `.jpeg`, `.webp`, `.avif`, `.gif`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.otf`, `.mp4`, `.webm`, `.mp3`, `.wav`, `.ogg`, `.m4a`, `.zip`) and **fail closed** on any unknown file extension in `dist/`.
  - Add TDD test cases in `scripts/test-protected-coords.mjs` proving that injected protected coordinates in `.md`, print-only HTML/CSS (`@media print` / `content: "..."`), and unknown file extensions in `dist/` fail the scan.
- **Unified Story Page (`scripts/prerender-pages.mjs`, `src/story-page/unified-story.css`, `src/story-print.css`, `scripts/build-story-md.mjs`):**
  - Render `/stories/<slug>/index.html` using the approved v2 unified layout (`usp-wayfinder`, `usp-shell`, `usp-article`, `usp-rail`).
  - Desktop (`>=1001px`): sticky right rail dock (`300px`) with compact interactive MapLibre map (`300x230`, basemap labels off, visible dark-mode roads, offset HTML pin labels, multi-marker support, `Open on map`, `Directions` for unprotected pins only, `Find photos`) above `On this page` TOC with scroll-spy (`aria-current="true"`).
  - Mobile (`<=1000px`): short inline map strip (`358x180`) after the markers block (`#uspMapMobile`), TOC hidden, portrait centered (`max-width: 240px`) below `560px` after the first paragraph, collapsed `<details>` for `At a glance` and `Cite`, and `44px` tap targets on interactive controls.
  - Protected stories: map snippet uses only the generalized `0.1°` rounded coordinate at `zoom <= 10` through a single rounding helper (`roundProtectedCoord`), omits coordinate `Directions` links on protected pins, and computes nearby distances from the rounded point.
  - Sticky wayfinder bar: `← Timeline · <year>` (with A+B+C return logic: `history.back()` when same-origin `#timeline` referrer/sessionStorage, else navigate to `/#timeline/<slug>`), `"Story N of 244 in timeline order"`, and `← Prev` / `Next →` in timeline order.
  - Ordered sections:
    1. Breadcrumb (`Home / <Layer or Stories> / <Title>`, always 3 levels in visible HTML and `BreadcrumbList` JSON-LD; hidden on mobile).
    2. Kicker, single `<h1>`, tag chips (`/stories/?q=<tag>`), years/era pill/counties meta row, lead.
    3. Tools row: `Save as PDF` (`window.print()`), `Download .md` (`<a href="/stories/<slug>/story.md" download="<slug>.md">`), `Share` (canonical `https://kyhistorydrive.com/stories/<slug>/`).
    4. Narrative (`<div class="story-body">`) with existing character bio portrait first (`<figure class="story-portrait">`), inline headshots without visible AI badge, full-size portraits keeping `"AI illustration · Kentucky History Drive"` (plus `"No known likeness exists"` when flagged), and transport link when `KHD_ROADS_RAILS=1`.
    5. `Kentucky today` immediately after the narrative, with the story photo inside its own cleared figure row (`usp-today-figure`) and no mockup-note box.
    6. `Historical markers`: marker number, KHS link (`explorekyhistory.ky.gov` or `history.ky.gov`), location, pin role (supporting multi-marker stories such as Father David Rice `#844` Greensburg + `#754` Concord Church in Danville), and `Directions: Apple Maps · Google Maps` (unprotected only).
    7. (`<=1000px` only) Short inline map strip with `Open on map` and `Find photos`.
    8. `People in this story`: linked to `/people/#<id>`, using existing portrait or clean initials card when no portrait exists.
    9. `Related stories`: 3 visible cards + `"More related stories (N)"` button when >3, neutral computed relationship notes, and non-empty portrait `alt` text on related cards.
    10. `Sources` (numbered) + collapsed `"At a glance and where sources differ"` (`<details class="usp-glance">`) + link to `/research/<slug>/` when a research outline exists.
    11. `Plan a drive` / `Take a Drive`: matching drive stop link (`takeADriveHtml`) when on a drive, or planner fallback (`/drives/build/#start=<town>`) when not on a drive.
    12. Collapsed `Cite this story` (`<details class="usp-cite-details">`) + `Report a correction`.
    13. `Prev / Next` cards once at the end + single `"Back to this spot on the Timeline"` link.
- **Build-time `.md` Export & Headers (`scripts/build-story-md.mjs`, `customHttp.yml`):**
  - Generate `dist/stories/<slug>/story.md` at build time strictly from the public rounded story record (never reading `/workspace/private/`).
  - Add `X-Robots-Tag: noindex` (with all 6 required security headers) to `customHttp.yml` for `'/stories/*/*.md'`, `'/content/stories/*.json'`, `'/content/research/*.json'`, and `/maps/routes/**/*.gpx|kml|geojson`.
- **Shared Header & Fuller Footer (`index.html`, `privacy/index.html`, `scripts/site-chrome.mjs`, `scripts/inject-drive-chrome.mjs`, `src/main.js`, `src/site-search.js`):**
  - Shared header across all pages: theme-aware seal, `Home` · `Stories` (`/stories/`) · `Timeline` (`/#timeline`) · `Map` (`/#map`) · `Drives` (`/drives/`) · `About` (`/about/` everywhere; `#about` and `#app` hashes forward to `/about/`), working `<form role="search" action="/">` (`name="q"`) on every page, `44px` search & theme toggle buttons, `<1100px` responsive collapse.
  - Fuller footer across all pages (`Stories` · `Map` · `Timeline` · `People` · `Drives` · `Route maps` · `Videos` · `Resources` · `About` · `Privacy`, `>=14px`, `44px` tap targets, 2-column grid on mobile).
  - `#145` a11y fix on `#heroZoomFullState` and `#zoomFullStateMap` in `index.html`.
  - Consistent era names (`Prehistoric`, `Native nations`, `Frontier`, `Early commonwealth`, `More Kentucky history`) and consistent new-tab link marking.
- **SEO, JSON-LD, Sitemap & Data Fixes:**
  - Short `<title>` `<= 60 chars` via `PrerenderPages.storyTitleTag(story)` using `<Short Name> (<Year>) · KY History Drive` (with the 6 long-title overrides), keeping full `<h1>`, `headline`, `og:title`, `twitter:title`.
  - Meta descriptions `120–155 chars` on all 244 story pages.
  - JSON-LD `Article` + 3-item `BreadcrumbList` (`Home` -> `<Layer or Stories>` -> `<Title>`), real-photo-only `image` (`photo.image_url` or seal fallback, never `/people/portraits/*`), `keywords` from `story.tags`, `about` `Place` node (`GeoCoordinates` omitted when protected), `mentions` `Person` nodes linked to `/people/#<id>`, `isBasedOn` source URLs.
  - Sitemap `<lastmod>` from content date (`story-dates.json` / `publishedDate` / `briefDate`, with index pages using max content date), not build-day git touch date.
  - Fix Father David Rice source 1 URL (`our-history96867eb2` -> `our-history`) in `public/content/stories/father-david-rice-1783.json` and `public/content/stories.json` (and bump `data_version` to `91` in `public/data/manifest.json` since `public/content/stories.json` is an app data file).
  - Fix `docs/SITE-CHARTER.md` pin-rounding documentation drift (`0.01° (~1 km)` -> `0.1° (~10 km)`).

---

## Task Breakdown (TDD)

1. **Task 1: Security Coordinate-Scan Gate (`scripts/check-protected-coords.mjs` + `scripts/test-protected-coords.mjs`)**
   - Add failing tests in `scripts/test-protected-coords.mjs` for `.md` coordinate leak, print-CSS coordinate leak, and unknown extension fail-closed behavior.
   - Update `scripts/check-protected-coords.mjs` to scan `.md`, `.xml`, `.txt`, `.svg`, `.css`, `pdftotext` on `.pdf`, and fail closed on unknown extensions.
   - Run `node scripts/test-protected-coords.mjs` and verify pass.

2. **Task 2: Data, Charter & Custom HTTP Headers (`customHttp.yml`, `docs/SITE-CHARTER.md`, Father David Rice source URL, `manifest.json`)**
   - Fix `our-history96867eb2` in `public/content/stories/father-david-rice-1783.json` and `public/content/stories.json`; bump `data_version` in `public/data/manifest.json` from `90` to `91`.
   - Fix `0.01° (~1 km)` -> `0.1° (~10 km)` in `docs/SITE-CHARTER.md`.
   - Update `customHttp.yml` to add `X-Robots-Tag: noindex` (with all 6 security headers) on `'/stories/*/*.md'`, `'/content/stories/*.json'`, `'/content/research/*.json'`, and `/maps/routes/**/*.gpx|kml|geojson`.
   - Run `node scripts/check-security-headers.mjs`.

3. **Task 3: Shared Header, Fuller Footer, `#145` a11y & Era Consistency (`scripts/site-chrome.mjs`, `scripts/inject-drive-chrome.mjs`, `index.html`, `privacy/index.html`, `src/main.js`, `src/site-search.js`, `src/mobile-nav.js`, `src/explore-layer.js`, `src/styles.css`)**
   - Update `scripts/site-chrome.mjs`, `index.html`, `privacy/index.html`, and `scripts/inject-drive-chrome.mjs` for the unified header, working `<form role="search" action="/">` (`q=`), `<1100px` collapse, and fuller footer.
   - Wire `?q=` query handling in `src/site-search.js` and `#about` / `#app` forwarding to `/about/` in `src/main.js`.
   - Update `#heroZoomFullState` and `#zoomFullStateMap` `aria-label` in `index.html`.
   - Align era labels in `src/main.js` and `src/explore-layer.js`.

4. **Task 4: Unified Story Page, Print CSS & Build-time `.md` Export (`src/story-page/unified-story.css`, `src/story-print.css`, `scripts/build-story-md.mjs`, `scripts/prerender-pages.mjs`, `scripts/test-unified-story-page.mjs`)**
   - Write `scripts/test-unified-story-page.mjs` testing titles `<= 60 chars`, meta descriptions `120–155 chars`, 3-level breadcrumbs, JSON-LD rules (no AI portrait in `image`, protected stories omit `GeoCoordinates`), protected story map rounding & no Directions link, multi-marker rendering (`#844` + `#754` on Father David Rice), `.md` generation, and print stylesheet rules.
   - Add `src/story-page/unified-story.css` and `src/story-print.css` and wire into `scripts/prerender-pages.mjs` (copied to `dist/assets/`).
   - Add `scripts/build-story-md.mjs` and wire into `package.json` build pipeline before `check-protected-coords.mjs`.
   - Update `scripts/prerender-pages.mjs` to render the unified story page and content-based sitemap `<lastmod>`.

5. **Task 5: Full Keyed Build, Verification & Screenshots**
   - Run full keyed `npm run build` and verify all checks pass (`check-protected-coords.mjs` last).
   - Capture desktop (1280px light/dark), mobile (390px light/dark), protected story, multi-marker story (Father David Rice), and print preview screenshots (<350 KB each) into `/workspace/qa-phase1-336/`.
   - Commit, push `v2-phase1-unified-story-336`, open PR against `v2`, and clean up preview server and temporary clone.
