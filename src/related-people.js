// Web-only cross-links between stories. Data: /data/web/related-people.json (no story text is edited).
let cache = null
export async function loadRelatedPeople() {
  if (cache) return cache
  try {
    const r = await fetch('/data/web/related-people.json')
    cache = r.ok ? await r.json() : { people: {}, skip: {}, related: {} }
  } catch {
    cache = { people: {}, skip: {}, related: {} }
  }
  return cache
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// "Related people & stories" block (empty string when a story has no entries).
export function relatedBlockHtml(data, slug, titleFor, headingId = 'storyRelatedH') {
  const seen = new Set()
  const items = (data?.related?.[slug] || []).filter((x) => {
    if (!x?.slug || x.slug === slug || seen.has(x.slug) || !titleFor(x.slug)) return false
    seen.add(x.slug)
    return true
  })
  if (!items.length) return ''
  const hid = String(headingId || 'storyRelatedH').replace(/[^\w-]/g, '') || 'storyRelatedH'
  const lis = items
    .map(
      (x) =>
        `<li><a href="#timeline/${encodeURIComponent(x.slug)}">${esc(titleFor(x.slug))}</a>${
          x.label ? ` <span class="related-note">— ${esc(x.label)}</span>` : ''
        }</li>`,
    )
    .join('')
  return `<aside class="story-related" aria-labelledby="${hid}"><h3 id="${hid}">Related people &amp; stories</h3><ul>${lis}</ul></aside>`
}

// Link the first mention of each known person (when they have their own story) inside the story body.
export function linkPeopleInBody(root, data, slug, titleFor) {
  const people = Object.entries(data?.people || {}).sort((a, b) => b[0].length - a[0].length)
  if (!root || !people.length) return
  const done = new Set() // target slugs already linked in this story
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('a, code, pre, button') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  })
  const nodes = []
  while (walker.nextNode()) nodes.push(walker.currentNode)
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    for (const [name, target] of people) {
      if (target === slug || done.has(target) || (data.skip?.[name] || []).includes(slug) || !titleFor(target)) continue
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}]|['’]s (?:Station|Fort))`, 'u')
      const text = node.nodeValue
      const m = re.exec(text)
      if (!m) continue
      const start = m.index + m[1].length
      const a = document.createElement('a')
      a.href = `#timeline/${encodeURIComponent(target)}`
      a.className = 'person-link'
      a.textContent = name
      a.title = `Read the story: ${titleFor(target)}`
      const after = node.splitText(start)
      after.nodeValue = after.nodeValue.slice(name.length)
      node.parentNode.insertBefore(a, after)
      done.add(target)
      nodes.push(node, after) // re-scan both halves for other people
      break
    }
  }
}
