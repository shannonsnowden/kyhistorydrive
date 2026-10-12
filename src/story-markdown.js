/**
 * Story body markdown for prerendered /stories/ pages and the hash reader.
 * Text is escaped. The only tags emitted are the ones this file writes.
 * Links are http(s) or site-relative. Anything else stays text.
 */
import { Lexer } from 'marked'

const LEXER_OPTIONS = { gfm: true, breaks: true }

function lex(markdown) {
  return Lexer.lex(String(markdown || ''), LEXER_OPTIONS)
}

const TAGS = new Set([
  'p', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'code', 'pre',
  'blockquote', 'del', 'table', 'caption', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'br', 'hr',
])

const GLANCE_FIELDS = [
  ['date', 'Date'],
  ['location', 'Place'],
  ['war', 'War'],
  ['belligerents', 'Belligerents'],
  ['commanders', 'Commanders'],
  ['strength', 'Strength'],
  ['casualties', 'Casualties'],
  ['result', 'Result'],
]

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function safeStoryUrl(href) {
  const raw = String(href || '').trim()
  if (!raw || raw.length > 2000) return ''
  if (/[\u0000-\u001F\s"'<>\\]/.test(raw)) return ''
  if (/^(?:javascript|data|vbscript|mailto):/i.test(raw)) return ''
  if (raw.startsWith('//')) return ''
  if (raw.startsWith('#') || raw.startsWith('/')) return raw
  let url
  try {
    url = new URL(raw)
  } catch {
    return ''
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
  if (url.username || url.password) return ''
  return url.href
}

export function isExternalStoryUrl(href) {
  return /^https?:\/\//i.test(String(href || ''))
}

export function researchPageHref(slug) {
  const id = String(slug || '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return ''
  return `/research/${id}/`
}

export function storyPageHref(slug) {
  const id = String(slug || '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return ''
  return `/stories/${id}/`
}

/** Drop the markdown "At a glance" table when the glance object is rendered. */
export function markdownWithoutGlanceSection(markdown, enabled = true) {
  const text = String(markdown || '')
  if (!enabled) return text
  return text.replace(/(^|\n)[ \t]*#{1,6}[ \t]+At a glance[ \t]*\n+(?:\|[^\n]*\n)*/i, '$1')
}

function cellText(cell) {
  return String(cell?.text || '').trim()
}

function renderTokens(tokens, out) {
  for (const token of tokens || []) {
    if (!token || typeof token !== 'object') continue
    switch (token.type) {
      case 'space':
        break
      case 'paragraph':
        out.open('p')
        renderTokens(token.tokens, out)
        out.close('p')
        break
      case 'heading': {
        const level = Math.min(6, Math.max(2, Number(token.depth) || 2))
        out.open(`h${level}`)
        renderTokens(token.tokens, out)
        out.close(`h${level}`)
        break
      }
      case 'text':
      case 'escape':
        if (token.tokens?.length) renderTokens(token.tokens, out)
        else out.text(token.text || '')
        break
      case 'br':
        out.el('br')
        break
      case 'html':
      case 'tag':
        out.text(token.text || token.raw || '')
        break
      case 'strong':
      case 'em':
      case 'del':
        out.open(token.type === 'del' ? 'del' : token.type)
        renderTokens(token.tokens, out)
        out.close(token.type === 'del' ? 'del' : token.type)
        break
      case 'codespan':
        out.open('code')
        out.text(token.text || '')
        out.close('code')
        break
      case 'code':
        out.open('pre')
        out.open('code')
        out.text(token.text || '')
        out.close('code')
        out.close('pre')
        break
      case 'link':
        renderLink(token, out)
        break
      case 'image':
        renderImage(token, out)
        break
      case 'list': {
        const tag = token.ordered ? 'ol' : 'ul'
        out.open(tag)
        for (const item of token.items || []) {
          out.open('li')
          renderTokens(item.tokens, out)
          out.close('li')
        }
        out.close(tag)
        break
      }
      case 'blockquote':
        out.open('blockquote')
        renderTokens(token.tokens, out)
        out.close('blockquote')
        break
      case 'hr':
        out.el('hr')
        break
      case 'table':
        renderTable(token, out)
        break
      default:
        if (token.tokens?.length) renderTokens(token.tokens, out)
        else if (token.text) out.text(token.text)
        break
    }
  }
}

function renderLink(token, out) {
  const href = safeStoryUrl(token.href)
  if (!href) {
    if (token.tokens?.length) renderTokens(token.tokens, out)
    else out.text(token.text || '')
    return
  }
  const external = isExternalStoryUrl(href)
  out.open('a', external ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href })
  if (token.tokens?.length) renderTokens(token.tokens, out)
  else out.text(token.text || href)
  if (external) {
    out.open('span', { class: 'visually-hidden' })
    out.text(' (opens in a new tab)')
    out.close('span')
  }
  out.close('a')
}

function renderImage(token, out) {
  const alt = token.text || token.title || ''
  const href = safeStoryUrl(token.href)
  if (!href) {
    out.text(alt)
    return
  }
  const external = isExternalStoryUrl(href)
  out.open('a', external ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href })
  out.text(alt || href)
  if (external) {
    out.open('span', { class: 'visually-hidden' })
    out.text(' (opens in a new tab)')
    out.close('span')
  }
  out.close('a')
}

function renderTable(token, out) {
  const headers = token.header || []
  const hasHeader = headers.some((cell) => cellText(cell))
  out.open('table')
  if (hasHeader) {
    out.open('thead')
    out.open('tr')
    for (const cell of headers) {
      out.open('th', { scope: 'col' })
      renderTokens(cell.tokens, out)
      out.close('th')
    }
    out.close('tr')
    out.close('thead')
  }
  out.open('tbody')
  for (const row of token.rows || []) {
    out.open('tr')
    row.forEach((cell, index) => {
      const label = !hasHeader && index === 0
      out.open(label ? 'th' : 'td', label ? { scope: 'row' } : {})
      renderTokens(cell.tokens, out)
      out.close(label ? 'th' : 'td')
    })
    out.close('tr')
  }
  out.close('tbody')
  out.close('table')
}

function checkedAttrs(tag, attrs) {
  if (!TAGS.has(tag)) throw new Error(`story markdown: tag ${tag}`)
  const out = {}
  if (!attrs) return out
  if (attrs.href != null) {
    const href = safeStoryUrl(attrs.href)
    if (!href) throw new Error('story markdown: unsafe href')
    out.href = href
  }
  if (attrs.target != null) {
    if (attrs.target !== '_blank' || !isExternalStoryUrl(out.href)) {
      throw new Error('story markdown: bad target')
    }
    out.target = '_blank'
    out.rel = 'noopener noreferrer'
  }
  if (attrs.rel != null && attrs.rel !== 'noopener noreferrer') throw new Error('story markdown: bad rel')
  if (attrs.scope != null) {
    if (tag !== 'th' || (attrs.scope !== 'row' && attrs.scope !== 'col')) {
      throw new Error('story markdown: bad scope')
    }
    out.scope = attrs.scope
  }
  if (attrs.class != null) {
    if (attrs.class !== 'visually-hidden' && attrs.class !== 'story-glance' && attrs.class !== 'story-glance-list' && attrs.class !== 'story-glance-sources') {
      throw new Error('story markdown: bad class')
    }
    out.class = attrs.class
  }
  return out
}

class HtmlOut {
  constructor() {
    this.parts = []
    this.stack = []
  }

  open(tag, attrs) {
    const safe = checkedAttrs(tag, attrs)
    if (tag === 'br' || tag === 'hr') throw new Error('story markdown: void tag')
    let attr = ''
    for (const [key, value] of Object.entries(safe)) attr += ` ${key}="${escapeHtml(value)}"`
    this.parts.push(`<${tag}${attr}>`)
    this.stack.push(tag)
  }

  close(tag) {
    const top = this.stack.pop()
    if (top !== tag) throw new Error(`story markdown: expected ${top}, closed ${tag}`)
    this.parts.push(`</${tag}>`)
  }

  el(tag) {
    if (tag !== 'br' && tag !== 'hr') throw new Error('story markdown: bad void')
    this.parts.push(`<${tag}>`)
  }

  text(value) {
    this.parts.push(escapeHtml(value))
  }

  html() {
    if (this.stack.length) throw new Error('story markdown: unclosed tags')
    return this.parts.join('')
  }
}

class DomOut {
  constructor(root) {
    this.stack = [root]
  }

  open(tag, attrs) {
    const safe = checkedAttrs(tag, attrs)
    const el = document.createElement(tag)
    for (const [key, value] of Object.entries(safe)) el.setAttribute(key, value)
    this.stack.at(-1).appendChild(el)
    this.stack.push(el)
  }

  close(tag) {
    const el = this.stack.pop()
    if (!el || el === this.stack[0] || el.tagName.toLowerCase() !== tag) {
      throw new Error(`story markdown: expected close ${tag}`)
    }
  }

  el(tag) {
    if (tag !== 'br' && tag !== 'hr') throw new Error('story markdown: bad void')
    this.stack.at(-1).appendChild(document.createElement(tag))
  }

  text(value) {
    this.stack.at(-1).appendChild(document.createTextNode(String(value ?? '')))
  }
}

export function renderStoryHtml(markdown) {
  const out = new HtmlOut()
  renderTokens(lex(markdown), out)
  return out.html()
}

export function mountStoryBody(el, markdown) {
  if (!el) return
  el.replaceChildren()
  const out = new DomOut(el)
  renderTokens(lex(markdown), out)
}

function glanceValues(value) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean)
  const text = String(value ?? '').trim()
  return text ? [text] : []
}

function sourceAnchor(notes, id) {
  const slug = String(notes?.slug || '')
  const sourceId = String(id || '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return ''
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceId)) return ''
  const known = (notes.sources || []).some((source) => source?.id === sourceId)
  if (!known) return ''
  return `/research/${slug}/#source-${sourceId}`
}

function renderGlanceValues(values, out) {
  if (values.length === 1) {
    out.text(values[0])
    return
  }
  out.open('ul', { class: 'story-glance-list' })
  for (const value of values) {
    out.open('li')
    out.text(value)
    out.close('li')
  }
  out.close('ul')
}

function renderGlance(glance, notes, out) {
  if (!glance || typeof glance !== 'object') return false
  const rows = []
  for (const [key, label] of GLANCE_FIELDS) {
    const values = glanceValues(glance[key])
    if (values.length) rows.push({ label, values })
  }
  const sourceRows = []
  for (const id of glance.sources || []) {
    const href = sourceAnchor(notes, id)
    const source = (notes?.sources || []).find((item) => item?.id === id)
    if (!href || !source) continue
    sourceRows.push({ href, text: String(source.citation || id) })
  }
  if (!rows.length && !sourceRows.length) return false
  out.open('table', { class: 'story-glance' })
  out.open('caption')
  out.text('At a glance')
  out.close('caption')
  out.open('tbody')
  for (const row of rows) {
    out.open('tr')
    out.open('th', { scope: 'row' })
    out.text(row.label)
    out.close('th')
    out.open('td')
    renderGlanceValues(row.values, out)
    out.close('td')
    out.close('tr')
  }
  out.close('tbody')
  out.close('table')
  if (sourceRows.length) {
    // Sources sit under the table (not in it) so the glance stays short on phones.
    const slug = String(notes?.slug || '')
    out.open('p', { class: 'story-glance-sources' })
    out.open('a', { href: `/research/${slug}/#sources` })
    out.text(`Sources for this table (${sourceRows.length}) on the research page →`)
    out.close('a')
    out.close('p')
  }
  return true
}

export function glanceTableHtml(glance, notes) {
  const out = new HtmlOut()
  renderGlance(glance, notes, out)
  return out.html()
}

export function mountGlanceTable(el, glance, notes) {
  if (!el) return
  el.replaceChildren()
  const out = new DomOut(el)
  renderGlance(glance, notes, out)
}

export function storyPlainText(markdown) {
  const blocks = []
  const walk = (tokens, inline) => {
    const parts = []
    for (const token of tokens || []) {
      if (!token) continue
      if (token.type === 'space' || token.type === 'hr') continue
      if (token.type === 'text' || token.type === 'escape' || token.type === 'codespan' || token.type === 'html' || token.type === 'tag') {
        parts.push(token.tokens?.length ? walk(token.tokens, true) : String(token.text || token.raw || ''))
        continue
      }
      if (token.type === 'br') {
        parts.push('\n')
        continue
      }
      if (token.type === 'paragraph' || token.type === 'heading' || token.type === 'blockquote') {
        const text = walk(token.tokens, true).trim()
        if (text) blocks.push(text)
        continue
      }
      if (token.type === 'list') {
        for (const item of token.items || []) {
          const text = walk(item.tokens, true).replace(/\s+/g, ' ').trim()
          if (text) blocks.push(text)
        }
        continue
      }
      if (token.type === 'table') {
        for (const row of token.rows || []) {
          const cells = row.map((cell) => walk(cell.tokens, true).replace(/\s+/g, ' ').trim()).filter(Boolean)
          if (cells.length) blocks.push(cells.join(' '))
        }
        continue
      }
      if (token.tokens?.length) parts.push(walk(token.tokens, true))
      else if (token.text) parts.push(String(token.text))
    }
    return inline ? parts.join('') : ''
  }
  walk(lex(markdown), false)
  return blocks.join('\n\n').trim()
}
