# Item 88 — temporary noindex on thin stories (Phase 6 content scope)

Goal: story pages whose narrative is under the threshold get `<meta name="robots" content="noindex, follow">`
and drop out of sitemap.xml, computed at build time; the tag disappears by itself once the text reaches 150.

1. `scripts/lib/thin-stories.mjs`: `storyWordCount(bodyMarkdown)` (skip headings, `Source:` lines,
   `## Sources`/`## People involved` sections, images/captions, HTML; links count as their text) and
   `isThinStory(story)` with `THIN_STORY_MIN_WORDS = 150`.
2. TDD: `scripts/test-thin-stories.mjs` — threshold-1 thin, threshold not thin, threshold+1 not thin, exclusions ignored.
   Runs in `npm run build` before prerender.
3. `prerender-pages.mjs` (small diff): pass `robots: THIN_ROBOTS` for thin stories, skip their sitemap entry,
   assert the tag is present/absent. Canonical and JSON-LD unchanged.
4. `npm run report:thin-stories` → `reports/thin-stories.{md,json}` (gitignored, not dist), prints summary.
5. Verify: keyed `META_CHECK=strict` build passes, check-protected-coords last; spot-check dist HTML and sitemap.
