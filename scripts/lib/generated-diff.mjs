/** Compare generated JSON data against a base version, allowing changes only inside allowlisted records. */

const IGNORE_KEYS = new Set(['generatedAt'])

function recKey(el) {
  if (!el || typeof el !== 'object' || Array.isArray(el)) return null
  const k = el.id ?? el.slug ?? el.properties?.id ?? el.properties?.slug
  return typeof k === 'string' || typeof k === 'number' ? String(k) : null
}
function keyedArray(arr) {
  if (!arr.length) return null
  const keys = arr.map(recKey)
  if (keys.some((k) => k == null) || new Set(keys).size !== keys.length) return null
  return keys
}
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x)

export function makeAllow(patterns) {
  const res = patterns.map((p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
  return (seg) => res.some((re) => re.test(String(seg)))
}

/** Problems ("path: what") for every difference outside an allowlisted record. */
export function diffJson(base, head, allow, path = '$') {
  const out = []
  if (isObj(base) && isObj(head)) {
    const bk = Object.keys(base).filter((k) => !IGNORE_KEYS.has(k))
    const hk = Object.keys(head).filter((k) => !IGNORE_KEYS.has(k))
    const bOrd = bk.filter((k) => !allow(k) && k in head)
    const hOrd = hk.filter((k) => !allow(k) && k in base)
    if (bOrd.join('\0') !== hOrd.join('\0')) out.push(`${path}: key order changed`)
    for (const k of new Set([...bk, ...hk])) {
      if (allow(k)) continue
      if (!(k in head)) out.push(`${path}.${k}: removed`)
      else if (!(k in base)) out.push(`${path}.${k}: added`)
      else out.push(...diffJson(base[k], head[k], allow, `${path}.${k}`))
    }
    return out
  }
  if (Array.isArray(base) && Array.isArray(head)) {
    const bk = keyedArray(base), hk = keyedArray(head)
    if (bk && hk) {
      const bm = new Map(base.map((e, i) => [bk[i], e])), hm = new Map(head.map((e, i) => [hk[i], e]))
      const bOrd = bk.filter((k) => !allow(k) && hm.has(k)), hOrd = hk.filter((k) => !allow(k) && bm.has(k))
      if (bOrd.join('\0') !== hOrd.join('\0')) out.push(`${path}: record order changed`)
      for (const k of new Set([...bk, ...hk])) {
        if (allow(k)) continue
        if (!hm.has(k)) out.push(`${path}[${k}]: removed`)
        else if (!bm.has(k)) out.push(`${path}[${k}]: added`)
        else out.push(...diffJson(bm.get(k), hm.get(k), allow, `${path}[${k}]`))
      }
      return out
    }
    if (base.length !== head.length) return [`${path}: length ${base.length} -> ${head.length}`]
    base.forEach((b, i) => out.push(...diffJson(b, head[i], allow, `${path}[${i}]`)))
    return out
  }
  return JSON.stringify(base) === JSON.stringify(head) ? [] : [`${path}: changed`]
}

/** base, with only the allowlisted records taken from head. */
export function mergeAllowed(base, head, allow) {
  if (isObj(base) && isObj(head)) {
    const out = {}
    const hkeys = Object.keys(head)
    for (const k of Object.keys(base)) {
      if (allow(k)) { if (k in head) out[k] = head[k]; continue }
      out[k] = k in head ? mergeAllowed(base[k], head[k], allow) : base[k]
    }
    // Allowlisted keys new in head: place after the preceding head key when possible.
    for (const k of hkeys) if (allow(k) && !(k in base)) out[k] = head[k]
    return out
  }
  if (Array.isArray(base) && Array.isArray(head)) {
    const bk = keyedArray(base), hk = keyedArray(head)
    if (!bk || !hk) return base
    const hm = new Map(head.map((e, i) => [hk[i], e]))
    const out = []
    base.forEach((e, i) => {
      const k = bk[i]
      if (allow(k)) { if (hm.has(k)) out.push(hm.get(k)) }
      else out.push(hm.has(k) ? mergeAllowed(e, hm.get(k), allow) : e)
    })
    hk.forEach((k, i) => { if (allow(k) && !bk.includes(k)) out.splice(Math.min(i, out.length), 0, head[i]) })
    return out
  }
  return base
}

/** Serialize like the base text (2-space or compact; same trailing newline). */
export function formatLike(baseText, data) {
  const indent = /^[[{]\r?\n/.test(baseText) ? 2 : 0
  return JSON.stringify(data, null, indent) + (baseText.endsWith('\n') ? '\n' : '')
}

/**
 * What to do when the merge base ref (origin/v2 or GENERATED_DIFF_BASE) is missing: 'skip' on a local
 * box, 'fail' in CI (fail closed). An Amplify build of the base branch itself or of main has nothing to
 * diff against (HEAD is the base), so it skips.
 */
export function missingBaseAction(env = {}, baseRef = 'origin/v2') {
  const truthy = (v) => v != null && v !== '' && !/^(0|false|no)$/i.test(String(v))
  const amplify = truthy(env.AWS_APP_ID) || truthy(env.AWS_BRANCH)
  const ci = truthy(env.CI) || truthy(env.GITHUB_ACTIONS) || truthy(env.CODEBUILD_BUILD_ID) || amplify
  if (!ci) return 'skip'
  const baseBranch = String(baseRef).replace(/^origin\//, '')
  if (amplify && (env.AWS_BRANCH === baseBranch || env.AWS_BRANCH === 'main')) return 'skip'
  return 'fail'
}
