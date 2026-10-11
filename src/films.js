/**
 * Films published on /videos/ and embedded on a matching story.
 * Add a row here; the videos page, sitemap, and story player follow it.
 *
 * pilot-full.mp4 (ffprobe, 2026-10-10): 1920×1080, format.duration 309.833333s → PT5M10S.
 * pilot-vertical.mp4 is 1080×1920 and 89.458s. Its captions file is timed to the
 * landscape pilot, and a 9:16 box at 600px would be taller than the story photo.
 * useVertical stays false so the page keeps one 16:9 box.
 */
export const FILMS = [
  {
    id: 'follow-the-river-home',
    title: 'Follow the River Home: Mary Draper Ingles',
    storySlug: 'mary-draper-ingles-escapes-through-kentucky-1755',
    runtimeLabel: 'About 5 minutes',
    duration: 'PT5M10S',
    durationSeconds: 310,
    uploadDate: '2026-10-10T09:00:00-04:00',
    credit: 'Produced and Directed by Shannon Snowden',
    creator: 'Shannon Snowden',
    director: 'Shannon Snowden',
    poster: 'https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com/videos/mary-ingles/poster.jpg',
    src: 'https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com/videos/mary-ingles/pilot-full.mp4',
    // Same-origin copy of the S3 VTT. A cross-origin track only loads where the
    // bucket sends Access-Control-Allow-Origin (the production host). Dev and
    // preview are other origins, so Chrome drops the track and hides CC.
    captions: '/content/captions/mary-ingles/pilot-full.vtt',
    captionsLang: 'en',
    captionsLabel: 'English',
    verticalSrc: 'https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com/videos/mary-ingles/pilot-vertical.mp4',
    useVertical: false,
  },
]

export function filmForStory(slug) {
  return FILMS.find((film) => film.storySlug === slug) || null
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * First two sentences of story prose. Abbreviations such as "Col." stay attached
 * to the next fragment so a caption is not cut on a title.
 */
export function filmDescriptionFromPlain(plain) {
  const text = String(plain || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z"'\u201C\u2018])/)
  const sentences = []
  let buf = ''
  const abbrev = (s) =>
    /\b(?:Jr|Sr|Dr|Capt|Col|Gen|Maj|Lt|Rev|Gov|Mr|Mrs|Ms|St|Ave|Mt|Ft|No|Co|Sts|Pres|Hon|vs|etc)\.$/.test(
      s.trimEnd(),
    ) ||
    /(?:^|[\s(])[A-Z]\.$/.test(s.trimEnd()) ||
    /\b(?:[A-Z]\.){2,}$/.test(s.trimEnd())
  for (const part of parts) {
    const piece = String(part || '').trim()
    if (!piece) continue
    buf = buf ? `${buf} ${piece}` : piece
    if (abbrev(buf)) continue
    sentences.push(buf)
    buf = ''
    if (sentences.length === 2) break
  }
  if (buf && sentences.length < 2) sentences.push(buf)
  return sentences.join(' ')
}

/** Absolute caption URL for JSON-LD. The player itself uses the site-relative path. */
export function filmCaptionAbsolute(film, pageUrl) {
  const src = film.captions || ''
  if (/^https?:/i.test(src)) return src
  const origin = new URL(pageUrl || 'https://kyhistorydrive.com/').origin
  return new URL(src, `${origin}/`).href
}

/** Schema.org VideoObject. Description is story prose passed in by the caller. */
export function videoObjectNode({ film, description, pageUrl, orgId }) {
  return {
    '@type': 'VideoObject',
    '@id': `${pageUrl}#${film.id}`,
    name: film.title,
    description,
    thumbnailUrl: film.poster,
    contentUrl: film.src,
    uploadDate: film.uploadDate,
    duration: film.duration,
    url: pageUrl,
    inLanguage: film.captionsLang || 'en',
    creator: { '@type': 'Person', name: film.creator },
    director: { '@type': 'Person', name: film.director },
    publisher: { '@id': orgId },
    caption: {
      '@type': 'MediaObject',
      contentUrl: filmCaptionAbsolute(film, pageUrl),
      encodingFormat: 'text/vtt',
      inLanguage: film.captionsLang || 'en',
      name: film.captionsLabel || 'English',
    },
  }
}

/**
 * Toggle the first text track. Static pages run this from an inline script;
 * the hash reader calls it after innerHTML (which does not execute scripts).
 */
export function wireFilmCaptions(root) {
  const scope = root && root.querySelectorAll ? root : document
  scope.querySelectorAll('.film-frame').forEach((frame) => {
    const video = frame.querySelector('video')
    const btn = frame.querySelector('.film-cc')
    if (!video || !btn || btn.dataset.ready) return
    btn.dataset.ready = '1'
    const track = () => (video.textTracks && video.textTracks.length ? video.textTracks[0] : null)
    const sync = () => {
      const item = track()
      const on = Boolean(item && item.mode === 'showing')
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
      btn.classList.toggle('is-on', on)
    }
    btn.addEventListener('click', () => {
      const item = track()
      if (!item) return
      item.mode = item.mode === 'showing' ? 'disabled' : 'showing'
      sync()
    })
    video.addEventListener('loadedmetadata', sync)
    if (video.textTracks) video.textTracks.addEventListener('addtrack', sync)
    sync()
  })
}

/**
 * Player markup. preload is metadata, there is no autoplay, and the frame
 * reserves a 16:9 box. The vertical file is included only when useVertical is set.
 *
 * No crossorigin attribute. The caption file is same-origin, so Chrome can read
 * it. crossorigin="anonymous" CORS-fetches the mp4 and the track; the bucket
 * only allows https://kyhistorydrive.com, which drops the track (and the CC
 * control) on every other origin.
 */
/** Poster, title, and summary. The story page is where the film is watched. */
export function filmCardHtml(film, { summary, href } = {}) {
  const summaryText = summary || ''
  const runtime = film.runtimeLabel
    ? `<p class="film-runtime">${escapeHtml(film.runtimeLabel)}</p>`
    : ''
  return `<a class="film-card" href="${escapeHtml(href)}">
      <img class="film-card-poster" src="${escapeHtml(film.poster)}" alt="" loading="lazy" decoding="async">
      <h2 class="film-title">${escapeHtml(film.title)}</h2>
      <p class="film-summary" title="${escapeHtml(summaryText)}">${escapeHtml(summaryText)}</p>
      ${runtime}
    </a>`
}

export function filmPlayerHtml(film, { summary, headingLevel = 2, moreHtml = '' } = {}) {
  const level = headingLevel === 3 ? 3 : 2
  const vertical = Boolean(film.useVertical && film.verticalSrc)
  const sources = vertical
    ? `<source src="${escapeHtml(film.verticalSrc)}" type="video/mp4" media="(max-width: 600px)">
        <source src="${escapeHtml(film.src)}" type="video/mp4">`
    : `<source src="${escapeHtml(film.src)}" type="video/mp4">`
  const frameClass = vertical ? 'film-frame film-frame-vertical' : 'film-frame'
  const runtime = film.runtimeLabel
    ? `<p class="film-runtime">${escapeHtml(film.runtimeLabel)}</p>`
    : ''
  const more = moreHtml ? `<p class="film-more">${moreHtml}</p>` : ''
  const summaryText = summary || ''
  return `<figure class="film-block" id="${escapeHtml(film.id)}">
      <figcaption class="film-lead">
        <h${level} class="film-title">${escapeHtml(film.title)}</h${level}>
        <p class="film-summary" title="${escapeHtml(summaryText)}">${escapeHtml(summaryText)}</p>
        ${runtime}
      </figcaption>
      <div class="${frameClass}">
        <video controls preload="metadata" playsinline width="100%" poster="${escapeHtml(film.poster)}" fetchpriority="low">
          ${sources}
          <track kind="subtitles" srclang="${escapeHtml(film.captionsLang || 'en')}" label="${escapeHtml(film.captionsLabel || 'English')}" default src="${escapeHtml(film.captions)}">
        </video>
        <button type="button" class="film-cc is-on" aria-pressed="true" aria-label="Captions">CC</button>
      </div>
      <p class="film-credit">${escapeHtml(film.credit)}</p>
      ${more}
      <script>(${wireFilmCaptions.toString()})(document.currentScript.closest('.film-block'))</script>
    </figure>`
}
