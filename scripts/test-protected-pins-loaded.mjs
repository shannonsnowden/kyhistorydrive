#!/usr/bin/env node
// Fail closed: if /data/web/protected-pins.json fails to load, protectedPinsLoaded() stays false,
// so the reader passes isProtected undefined and takeADriveHtml returns no drive markup.
import assert from 'node:assert/strict'
globalThis.fetch = () => Promise.reject(new Error('network down (fixture)'))
const { loadProtectedPins, protectedPinsLoaded } = await import('../src/protected-pins.js')
const { takeADriveHtml } = await import('../src/take-a-drive.js')
await loadProtectedPins()
assert.equal(protectedPinsLoaded(), false, 'a failed protected-pins fetch must not count as loaded')
const data = { drives: { 'sample-trail': { name: 'Sample Trail' } }, stories: { 'sampletown-story': ['sample-trail'] } }
assert.equal(takeADriveHtml(data, 'sampletown-story', { isProtected: protectedPinsLoaded() ? false : undefined }), '', 'list did not load: no drive markup')
console.log('test-protected-pins-loaded: OK (failed load fails closed)')
