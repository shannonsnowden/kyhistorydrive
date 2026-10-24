# Item 88: story text expansion (existing stories)

Goal: wire KY History's expanded bodies for existing stories into `v2`. No new stories.

1. For each slug in `/workspace/item88/bodies/<slug>.md`, set `bodyMarkdown` in the tracked source `public/content/stories/<slug>.json`. No other fields change; JSON keeps 2-space indent and key order.
2. Swap Wikipedia links to Grokipedia only where `grokipedia.com/page/<slug>` returns 200 (exact or lowercase).
3. `data/people.json`: `will-emery` nation = `Cherokee (mixed descent), with the Shawnee`.
4. Verify: every slug is above the 150-word line (PR #344 counter); diff touches only `bodyMarkdown` and the one people field; keyed build with `META_CHECK=strict` passes, with `check-protected-coords` last.
5. Batch 3 (8 slugs) added; jacob-beam-sells-old-jakes-first-barrel and wea-towns-at-ouiatenon-and-scotts-1791-kentucky-raid skipped per Editor. Later batches get added to this PR.
