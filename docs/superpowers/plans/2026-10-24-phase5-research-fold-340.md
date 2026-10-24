# v2 Phase 5 (#340): fold research notes into story pages

Goal: the 16 research outlines render inside their story page ("Research notes" block under
"Sources and research", id `research-notes`); `/research/<slug>/` for those 16 stops being built and
301s one by one (no wildcard) to `/stories/<storySlug>/`. The 7 culture image-evidence pages stay
built but are `noindex, follow` and out of the sitemap (figure "See the evidence" links still work).

Steps (TDD):
1. `scripts/test-research-fold.mjs` (red): `isFoldedResearch`, `foldedResearchHtml` escaping, unique
   ids (`rn-source-*`, never `id="sources"`), glance links to `#research-notes` / `#rn-source-*` when
   folded, culture pages unchanged; amplify.yml has exactly 2 explicit 301s per folded note and no
   `/research/<*>` wildcard; `uniqueTitleProblems` helper.
2. `src/story-markdown.js`: `isFoldedResearch(notes)`; glance source links point on-page when folded.
3. `src/research-notes.js`: `foldedResearchHtml(notes)` (h3/h4, escaped, external links noopener).
4. `scripts/prerender-pages.mjs`: embed fold in story page; build only culture research pages with
   `robots: noindex, follow`; keep them out of the sitemap; assertStory requires the fold.
5. `src/main.js`: client story view links `#research-notes` instead of `/research/`.
6. `amplify.yml`: 32 explicit 301 rules. Blue Licks body drops its /research/ link line.
7. `scripts/check-unique-titles.mjs`: indexable dist pages must have unique <title> and <h1>; wired into
   build before check-protected-coords (which stays last).
8. Verify: all unit tests + keyed strict build.
