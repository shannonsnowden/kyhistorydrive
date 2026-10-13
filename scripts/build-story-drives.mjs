#!/usr/bin/env node
// Writes public/data/web/story-drives.json (story slug -> drive ids) for the Timeline's Take a Drive button.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storyDrives } from './story-drives-lib.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = storyDrives(root)
const out = path.join(root, 'public/data/web/story-drives.json')
const json = JSON.stringify(data, null, 1) + '\n'
if (!fs.existsSync(out) || fs.readFileSync(out, 'utf8') !== json) fs.writeFileSync(out, json)
console.log(`build-story-drives: ${Object.keys(data.stories).length} stories on ${Object.keys(data.drives).length} drives`)
