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
    uploadDate: '2026-10-10',
    credit: 'Produced and Directed by Shannon Snowden',
    creator: 'Shannon Snowden',
    director: 'Shannon Snowden',
    poster: 'https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com/videos/mary-ingles/poster.jpg',
    src: 'https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com/videos/mary-ingles/pilot-full.mp4',
    captions: 'https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com/videos/mary-ingles/pilot-full.vtt',
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
    ) || /(?:^|[\s(])[A-Z]\.$/.test(s.trimEnd())
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
      contentUrl: film.captions,
      encodingFormat: 'text/vtt',
      inLanguage: film.captionsLang || 'en',
      name: film.captionsLabel || 'English',
    },
  }
}

/**
 * Player markup. preload is metadata, there is no autoplay, and the frame
 * reserves a 16:9 box. The vertical file is included only when useVertical is set.
 */
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
  return `<figure class="film-block" id="${escapeHtml(film.id)}">
      <figcaption class="film-lead">
        <h${level} class="film-title">${escapeHtml(film.title)}</h${level}>
        <p class="film-summary">${escapeHtml(summary || '')}</p>
        ${runtime}
      </figcaption>
      <div class="${frameClass}">
        <video controls preload="metadata" playsinline crossorigin="anonymous" width="100%" poster="${escapeHtml(film.poster)}" fetchpriority="low">
          ${sources}
          <track kind="subtitles" srclang="${escapeHtml(film.captionsLang || 'en')}" label="${escapeHtml(film.captionsLabel || 'English')}" default src="${escapeHtml(film.captions)}">
        </video>
      </div>
      <p class="film-credit">${escapeHtml(film.credit)}</p>
      ${more}
    </figure>`
}
