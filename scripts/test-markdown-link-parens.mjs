#!/usr/bin/env node
/**
 * Markdown links whose URL has one level of parentheses (Wikipedia/Grokipedia disambiguation,
 * e.g. Big_Sandy_River_(Ohio_River_tributary)) must strip to their link text with no stray ")".
 * Covers src/home-hero-render.js firstSentence and the shared stripMarkdownLinks used by
 * build-home-preview.mjs and prerender-pages.mjs (#329 C&O lede).
 */
import assert from 'node:assert/strict'
import { firstSentence } from '../src/home-hero-render.js'
import { stripMarkdownLinks } from '../src/markdown-links.js'

const md = 'On the [Levisa Fork](https://en.wikipedia.org/wiki/Levisa_Fork) of the [Big Sandy River](https://grokipedia.com/page/Big_Sandy_River_(Ohio_River_tributary)) at [Paintsville](https://grokipedia.com/page/Paintsville,_Kentucky), people raised mounds. Second sentence.'
const plain = 'On the Levisa Fork of the Big Sandy River at Paintsville, people raised mounds. Second sentence.'
assert.equal(stripMarkdownLinks(md), plain)
assert.equal(firstSentence(md), 'On the Levisa Fork of the Big Sandy River at Paintsville, people raised mounds.')
// Plain URLs and percent-encoded parens keep working.
assert.equal(stripMarkdownLinks('[A](/stories/a/) and [B](https://x.org/B_%28c%29)'), 'A and B')
assert.equal(stripMarkdownLinks('no links (just parens)'), 'no links (just parens)')
console.log('test-markdown-link-parens: ok')
