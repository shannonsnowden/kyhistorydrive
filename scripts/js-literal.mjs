/**
 * Safe parser for the plain JS data literals in the drive pages (const STOPS = [...]).
 * Accepts arrays, objects with bare or quoted keys, '...'/"..." strings, numbers, true/false/null,
 * comments and trailing commas. Anything else (calls, expressions, template strings) throws, so no
 * page text is ever executed (replaces new Function).
 */
export function parseJsLiteral(src) {
  let i = 0
  const err = (m) => { throw new Error(`parseJsLiteral: ${m} at ${i}: ${JSON.stringify(src.slice(i, i + 30))}`) }
  const ws = () => {
    for (;;) {
      if (/\s/.test(src[i] || '')) i++
      else if (src.startsWith('//', i)) { const n = src.indexOf('\n', i); i = n < 0 ? src.length : n }
      else if (src.startsWith('/*', i)) { const n = src.indexOf('*/', i + 2); if (n < 0) err('unclosed comment'); i = n + 2 }
      else return
    }
  }
  const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0', '\n': '' }
  const str = () => {
    const q = src[i++]
    let out = ''
    while (i < src.length && src[i] !== q) {
      let c = src[i++]
      if (c === '\\') {
        c = src[i++]
        if (c === 'u') {
          if (src[i] === '{') { const e = src.indexOf('}', i); out += String.fromCodePoint(parseInt(src.slice(i + 1, e), 16)); i = e + 1 }
          else { out += String.fromCharCode(parseInt(src.slice(i, i + 4), 16)); i += 4 }
        } else if (c === 'x') { out += String.fromCharCode(parseInt(src.slice(i, i + 2), 16)); i += 2 }
        else out += c in ESC ? ESC[c] : c
      } else if (c === '\n') err('newline in string')
      else out += c
    }
    if (src[i] !== q) err('unclosed string')
    i++
    return out
  }
  const value = () => {
    ws()
    const c = src[i]
    if (c === '[') {
      i++; const a = []
      for (;;) { ws(); if (src[i] === ']') { i++; return a } a.push(value()); ws(); if (src[i] === ',') i++; else if (src[i] !== ']') err('expected , or ]') }
    }
    if (c === '{') {
      i++; const o = {}
      for (;;) {
        ws(); if (src[i] === '}') { i++; return o }
        let k
        if (src[i] === '"' || src[i] === "'") k = str()
        else { const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(src.slice(i)); if (!m) err('bad key'); k = m[0]; i += k.length }
        if (k === '__proto__') err('forbidden key')
        ws(); if (src[i] !== ':') err('expected :'); i++
        o[k] = value(); ws()
        if (src[i] === ',') i++; else if (src[i] !== '}') err('expected , or }')
      }
    }
    if (c === '"' || c === "'") return str()
    const m = /^(?:-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|true|false|null)(?![\w$])/.exec(src.slice(i))
    if (!m) err('unexpected token')
    i += m[0].length
    return m[0] === 'true' ? true : m[0] === 'false' ? false : m[0] === 'null' ? null : Number(m[0])
  }
  const v = value(); ws()
  if (i !== src.length) err('trailing content')
  return v
}
