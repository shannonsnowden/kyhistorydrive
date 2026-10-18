#!/usr/bin/env node
/**
 * Writes the Roads & Rails line rows into roads-and-rails/index.html between
 * <!-- khd-rr-lines:start --> and <!-- khd-rr-lines:end --> so they are crawlable without JS.
 * Run after editing src/transport-lines.js or sections.geojson; scripts/test-transport-rows.mjs fails on drift.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { buildLineRows, linesHtml } from '../src/transport-lines.js'

const file = new URL('../roads-and-rails/index.html', import.meta.url)
const secs = JSON.parse(readFileSync(new URL('../public/maps/transport/sections.geojson', import.meta.url), 'utf8'))
const html = readFileSync(file, 'utf8')
const A = '<!-- khd-rr-lines:start -->'
const B = '<!-- khd-rr-lines:end -->'
const i = html.indexOf(A)
const j = html.indexOf(B)
if (i < 0 || j < i) throw new Error('build-transport-rows: markers missing in roads-and-rails/index.html')
writeFileSync(file, html.slice(0, i + A.length) + linesHtml(buildLineRows(secs.features)) + html.slice(j))
console.log('build-transport-rows: wrote line rows into roads-and-rails/index.html')
