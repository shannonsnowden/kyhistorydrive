/**
 * Story -> drive data, read straight from each /drives/<id>/ page's STOPS (the same source
 * build-drive-pages.mjs prerenders). A story is "on a drive" when any stop lists it in stop.stories.
 * The drive id is the folder slug (stable: it is also the drive's URL).
 */
import fs from 'node:fs'
import path from 'node:path'

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#x27;': "'", '&#39;': "'" }
const plain = (s) => {
  let out = String(s).replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (m) => ENT[m])
  for (let prev; prev !== out;) { prev = out; out = out.replace(/<[^<>]*>/g, '') }
  return out.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
}

export const DRIVE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** { drives: { id: { name } }, stories: { storySlug: [driveId, ...] } }, ids in drive-index order. */
export function storyDrives(root) {
  const DP = path.join(root, 'public/drives')
  const idx = fs.readFileSync(path.join(DP, 'index.html'), 'utf8')
  const order = [...idx.matchAll(/href="\/drives\/([a-z0-9-]+)\/"/g)].map((x) => x[1]).filter((s, i, a) => s !== 'build' && a.indexOf(s) === i)
  const drives = {}
  const stories = {}
  for (const id of order) {
    if (!DRIVE_ID_RE.test(id)) throw new Error(`story-drives: bad drive id ${id}`)
    const html = fs.readFileSync(path.join(DP, id, 'index.html'), 'utf8')
    const m = html.match(/const STOPS = (\[[\s\S]*?\n\])/)
    if (!m) continue
    const stops = new Function(`return ${m[1]}`)()
    const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)
    drives[id] = { name: plain(h1 ? h1[1] : id) }
    for (const s of stops) for (const [slug] of s.stories || []) {
      const list = (stories[slug] ??= [])
      if (!list.includes(id)) list.push(id)
    }
  }
  return { drives, stories }
}
