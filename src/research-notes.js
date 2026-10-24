/**
 * Research notes pages. Every string from the JSON is escaped.
 * There is no raw HTML in this content.
 */
import { escapeHtml, isExternalStoryUrl, isFoldedResearch, safeStoryUrl, storyPageHref } from './story-markdown.js'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SOURCE_HEADINGS = {
  primary: 'Primary sources',
  secondary: 'Secondary sources',
}

function safeId(value) {
  const id = String(value || '')
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? id : ''
}

function formatUpdated(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return ''
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${MONTHS[month - 1]} ${day}, ${match[1]}`
}

function knownSourceIds(notes) {
  const ids = new Map()
  for (const source of notes?.sources || []) {
    const id = safeId(source?.id)
    if (id) ids.set(id, source)
  }
  return ids
}

/** Readable chip text: the source's short label, else a tidied id ("caldwell-1782" -> "Caldwell 1782"). */
function sourceLabel(id, source) {
  const short = String(source?.short || '').trim()
  if (short) return short
  return String(id)
    .split('-')
    .map((w) => (/^\d+$/.test(w) ? w : w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

function citeHtml(ids, known) {
  const bits = []
  for (const id of ids || []) {
    const sourceId = safeId(id)
    if (sourceId && known.has(sourceId)) {
      bits.push(`<a class="research-cite" href="#source-${sourceId}">${escapeHtml(sourceLabel(sourceId, known.get(sourceId)))}</a>`)
    } else if (id) bits.push(`<span class="research-cite is-plain">${escapeHtml(sourceLabel(id))}</span>`)
  }
  if (!bits.length) return ''
  return ` <span class="research-cites"><span class="visually-hidden">Sources: </span>${bits.join(' ')}</span>`
}

function sectionHtml(section, known) {
  const heading = String(section?.heading || '').trim()
  const items = (section?.items || [])
    .map((item) => {
      const text = String(item?.text || '').trim()
      if (!text) return ''
      return `<li>${escapeHtml(text)}${citeHtml(item.sources, known)}</li>`
    })
    .filter(Boolean)
  if (!heading || !items.length) return ''
  return `<section class="research-section">
      <h2>${escapeHtml(heading)}</h2>
      <ul>${items.join('')}</ul>
    </section>`
}

function timelineHtml(notes, known) {
  const items = (notes.timeline || [])
    .map((row) => {
      const event = String(row?.event || '').trim()
      if (!event) return ''
      const year = row?.year == null ? '' : String(row.year)
      const when = year ? `<span class="research-year">${escapeHtml(year)}</span> ` : ''
      return `<li>${when}${escapeHtml(event)}${citeHtml(row.sources, known)}</li>`
    })
    .filter(Boolean)
  if (!items.length) return ''
  return `<section class="research-section">
      <h2>Timeline</h2>
      <ol class="research-timeline">${items.join('')}</ol>
    </section>`
}

function peopleHtml(notes) {
  const items = (notes.people || [])
    .map((person) => {
      const name = String(person?.name || '').trim()
      if (!name) return ''
      const id = safeId(person.peopleId)
      const nameHtml = id ? `<a href="/people/#${id}">${escapeHtml(name)}</a>` : escapeHtml(name)
      const role = String(person?.role || '').trim()
      const roleHtml = role ? ` <span class="research-role">${escapeHtml(role)}</span>` : ''
      return `<li>${nameHtml}${roleHtml}</li>`
    })
    .filter(Boolean)
  if (!items.length) return ''
  return `<section class="research-section">
      <h2>People</h2>
      <ul class="research-people">${items.join('')}</ul>
    </section>`
}

function questionsHtml(notes) {
  const items = (notes.openQuestions || [])
    .map((question) => {
      const text = String(question || '').trim()
      return text ? `<li>${escapeHtml(text)}</li>` : ''
    })
    .filter(Boolean)
  if (!items.length) return ''
  return `<section class="research-section">
      <h2>Open questions</h2>
      <ul>${items.join('')}</ul>
    </section>`
}

function sourceItemHtml(source) {
  const id = safeId(source?.id)
  const citation = String(source?.citation || source?.url || '').trim()
  if (!citation && !id) return ''
  const href = safeStoryUrl(source?.url)
  const text = escapeHtml(citation || id)
  const external = href && isExternalStoryUrl(href)
  const body = href
    ? `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}${external ? '<span class="visually-hidden"> (opens in a new tab)</span>' : ''}</a>`
    : text
  const idAttr = id ? ` id="source-${id}"` : ''
  return `<li${idAttr}>${body}</li>`
}

function sourcesHtml(notes) {
  const groups = new Map()
  for (const source of notes.sources || []) {
    const type = String(source?.type || '').trim().toLowerCase() || 'other'
    if (!groups.has(type)) groups.set(type, [])
    const item = sourceItemHtml(source)
    if (item) groups.get(type).push(item)
  }
  const blocks = []
  for (const [type, items] of groups) {
    if (!items.length) continue
    const heading = SOURCE_HEADINGS[type] || type
    blocks.push(`<h3>${escapeHtml(heading)}</h3><ul>${items.join('')}</ul>`)
  }
  if (!blocks.length) return ''
  return `<section class="research-section" id="sources">
      <h2>Sources</h2>
      ${blocks.join('')}
    </section>`
}

export function researchNotesHtml(notes) {
  const slug = safeId(notes?.slug)
  const back = storyPageHref(notes?.storySlug)
  if (!slug || !back) return ''
  const title = String(notes.title || '').trim()
  if (!title) return ''
  const summary = String(notes.summary || '').trim()
  const updated = formatUpdated(notes.updated)
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(notes.updated || '')) ? String(notes.updated) : ''
  const known = knownSourceIds(notes)
  const updatedHtml = updated
    ? `<p class="research-updated">Updated <time datetime="${escapeHtml(iso)}">${escapeHtml(updated)}</time></p>`
    : ''
  return `<article class="research-notes">
      <p class="back-link"><a class="back-pill" href="${escapeHtml(back)}">Back to story</a></p>
      <header class="story-head">
        <p class="static-kicker">Research notes</p>
        <h1>${escapeHtml(title)}</h1>
        ${summary ? `<p class="story-lead">${escapeHtml(summary)}</p>` : ''}
        ${updatedHtml}
      </header>
      ${(notes.sections || []).map((section) => sectionHtml(section, known)).join('')}
      ${timelineHtml(notes, known)}
      ${peopleHtml(notes)}
      ${questionsHtml(notes)}
      ${sourcesHtml(notes)}
    </article>`
}

/**
 * v2 Phase 5 (#340): the same outline folded into its story page, under "Sources and research".
 * h3/h4 only (the page keeps one h1), ids prefixed rn- so nothing clashes with the story's #sources.
 * Culture image-evidence notes never fold (they keep their own noindex page).
 */
export function foldedResearchHtml(notes) {
  if (!isFoldedResearch(notes) || !storyPageHref(notes?.storySlug)) return ''
  const known = knownSourceIds(notes)
  const cite = (ids) => citeHtml(ids, known).replace(/href="#source-/g, 'href="#rn-source-')
  const block = (heading, inner, tag = 'ul', cls = '') =>
    inner.length ? `<section class="research-section"><h4>${escapeHtml(heading)}</h4><${tag}${cls ? ` class="${cls}"` : ''}>${inner.join('')}</${tag}></section>` : ''
  const parts = []
  for (const section of notes.sections || []) {
    const heading = String(section?.heading || '').trim()
    const items = (section?.items || [])
      .map((item) => {
        const text = String(item?.text || '').trim()
        return text ? `<li>${escapeHtml(text)}${cite(item.sources)}</li>` : ''
      })
      .filter(Boolean)
    if (heading) parts.push(block(heading, items))
  }
  const timeline = (notes.timeline || [])
    .map((row) => {
      const event = String(row?.event || '').trim()
      if (!event) return ''
      const year = row?.year == null ? '' : String(row.year)
      return `<li>${year ? `<span class="research-year">${escapeHtml(year)}</span> ` : ''}${escapeHtml(event)}${cite(row.sources)}</li>`
    })
    .filter(Boolean)
  parts.push(block('Timeline', timeline, 'ol', 'research-timeline'))
  const people = (notes.people || [])
    .map((person) => {
      const name = String(person?.name || '').trim()
      if (!name) return ''
      const id = safeId(person.peopleId)
      const role = String(person?.role || '').trim()
      return `<li>${id ? `<a href="/people/#${id}">${escapeHtml(name)}</a>` : escapeHtml(name)}${role ? ` <span class="research-role">${escapeHtml(role)}</span>` : ''}</li>`
    })
    .filter(Boolean)
  parts.push(block('People', people, 'ul', 'research-people'))
  const questions = (notes.openQuestions || []).map((q) => String(q || '').trim()).filter(Boolean).map((q) => `<li>${escapeHtml(q)}</li>`)
  parts.push(block('Open questions', questions))
  const groups = new Map()
  for (const source of notes.sources || []) {
    const type = String(source?.type || '').trim().toLowerCase() || 'other'
    const item = sourceItemHtml(source).replace(/^<li id="source-/, '<li id="rn-source-')
    if (!item) continue
    if (!groups.has(type)) groups.set(type, [])
    groups.get(type).push(item)
  }
  for (const [type, items] of groups) parts.push(block(`${SOURCE_HEADINGS[type] || type} (research notes)`, items))
  const body = parts.filter(Boolean).join('')
  if (!body) return ''
  const updated = formatUpdated(notes.updated)
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(String(notes.updated || '')) ? String(notes.updated) : ''
  return `<div class="research-fold" id="research-notes"><h3 id="research-notes-heading">Research notes</h3>${
    updated ? `<p class="research-updated">Updated <time datetime="${escapeHtml(iso)}">${escapeHtml(updated)}</time></p>` : ''
  }${body}</div>`
}
