# v2 Phase 2 (#337, item 101): merges and story links — implementation plan

Target branch: `v2`. Scope is issue #337 only. Phases 3–5 stay held; no new stories or portraits (#331/#334 frozen).

## Tasks (TDD: each test is written and seen failing first)

1. **Merge list + redirect block (f).** `data/story-merges.json` holds KY History's seven pairs
   (cleanup plan, Appendix B). `scripts/lib/story-merges.mjs` validates the list and builds block (f)
   (slash and slashless sources, final `/stories/<kept>/` targets). `scripts/build-merge-redirects.mjs`
   writes `docs/redirects/block-f-merges.json` with `--write` and, in the build, fails on drift,
   redirect chains, loops, duplicate sources, dead targets (kept story file missing) or a retired
   story file that still exists. Test: `scripts/test-story-merges.mjs` (fixtures for chain, loop, dead target).
2. **Retire the seven duplicates.** Move each retired story JSON to `data/archive/merged-stories/`
   (KY History folds any text worth keeping into the kept page). Repoint every reference
   (people.json, BYOD stops, drive pages, story body links, curated photo/transport maps) to the kept slug. 244 → 237.
3. **Protection survives a merge.** `isProtectedStory` treats a kept slug as protected when any retired
   source was protected. Fixture test in `test-story-merges.mjs`.
4. **One protected check (Phase 1 note a).** `src/story-tools.js` exports the single rule
   (`isProtectedStoryCoords(story, { protectedIds, skipIds })`); `unified-story-data.mjs` delegates to it
   with the full build-time sets; the browser feeds it `/data/web/protected-pins.json` through `protected-pins.js`.
5. **Research notes in story.md (Phase 1 note b).** `build-story-md.mjs` reads `public/content/research/*.json`
   (the real path) and the `locations` map of `stories-locations.json`; coordinates still go through `roundedStoryGeo`.
6. **Pins.** Story overrides may carry a link-only `historyId` (plus `alsoHistoryIds`); `build-stories-locations.mjs`
   honours it (fixes the Lawrenceburg generator bug). Link Newport, Michael Stoner, Lawrenceburg, Ann McGinty,
   Henry McKenna, Carter Caves Cascade and Concord Church pins. Move the Stoner History pin to Fort Boonesborough, Madison County.
7. **People data.** Add the six missing people (no likeness, no portraits) and add each person's full-name
   mentions to their `stories` list (`scripts/fix-people-mentions.mjs`, idempotent, `--check` in tests).
8. **Every story link → `/stories/<slug>/`.** Homepage cards, search, Today's stories, related people,
   route maps and Share use `storyPageUrl()` (`src/story-url.js`). Old `#timeline/<slug>` links on first
   load forward with `location.replace` (retired slugs go to the kept page). Test: `scripts/test-story-links.mjs`.

## Verification
Keyed `META_CHECK=strict` build with `check-protected-coords` last; 237 story pages; block (f) self-check;
desktop + mobile screenshots under `/workspace/qa-phase2-337/`.
