/**
 * One Google tag for every page. index.html, privacy, and the home-preview
 * redirect receive it from the Vite plugin. Prerendered /about/, /stories/,
 * and /layers/ pages insert gtagHeadHtml() in the shell. Do not copy the
 * snippet into a page by hand.
 *
 * Consent Mode v2 defaults match Google's regional pattern for an async CMP
 * (AdSense Privacy & messaging, loaded by the existing adsbygoogle.js tag):
 * denied in the EEA, the UK, and Switzerland, with wait_for_update so that
 * message can call gtag('consent','update') itself, and granted everywhere
 * else. send_page_view is false so the manual page_view below is the only
 * one. Hash routes send another page_view on hashchange. The map button
 * and timeline story clicks update the hash with history.replaceState,
 * which does not fire hashchange, so those calls are observed too.
 * A repeat of the same page_path is ignored, which keeps the first view
 * from being counted twice.
 *
 * The measurement ID is public. The external script is async.
 */
export const GA_MEASUREMENT_ID = 'G-83G4SBQKT1'

/**
 * ISO 3166-1 alpha-2 codes. EEA is the EU 27 plus Iceland, Liechtenstein,
 * and Norway. GB is the United Kingdom. CH is Switzerland.
 * https://developers.google.com/tag-platform/security/guides/consent
 */
export const CONSENT_OPT_IN_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
  'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
  'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
]

export function gtagHeadHtml() {
  const quoted = CONSENT_OPT_IN_REGIONS.map((code) => `'${code}'`)
  const lines = []
  for (let i = 0; i < quoted.length; i += 8) lines.push(quoted.slice(i, i + 8).join(', '))
  const regionLiteral = lines.join(',\n        ')
  return `<!-- Google tag (gtag.js) -->
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('consent', 'default', {
        'ad_storage': 'denied',
        'ad_user_data': 'denied',
        'ad_personalization': 'denied',
        'analytics_storage': 'denied',
        'wait_for_update': 500,
        'region': [${regionLiteral}]
      });
      gtag('consent', 'default', {
        'ad_storage': 'granted',
        'ad_user_data': 'granted',
        'ad_personalization': 'granted',
        'analytics_storage': 'granted'
      });
      gtag('js', new Date());
      gtag('config', '${GA_MEASUREMENT_ID}', { 'send_page_view': false });
      var khdLastPagePath = '';
      var khdTitleWait = null;
      function khdHashParts() {
        var raw = (location.hash || '').replace(/^#/, '').split('?')[0];
        return raw ? raw.split('/') : [];
      }
      function khdStorySlug() {
        var parts = khdHashParts();
        var head = parts[0] || '';
        if (head !== 'timeline' && head !== 'stories' && head !== 'story') return '';
        if (!parts[1]) return '';
        try { return decodeURIComponent(parts.slice(1).join('/')); }
        catch (e) { return parts.slice(1).join('/'); }
      }
      function khdLookupStoryTitle(slug) {
        if (!slug) return '';
        var map = window.__khdStoryTitles;
        if (map && map[slug]) return map[slug];
        var node = document.querySelector('[data-slug="' + slug.replace(/"/g, '') + '"] strong');
        if (node && node.textContent.trim()) return node.textContent.trim();
        var links = document.querySelectorAll('a[href]');
        for (var i = 0; i < links.length; i++) {
          var href = links[i].getAttribute('href') || '';
          var hash = href.split('#')[1] || '';
          if (hash !== 'timeline/' + slug) continue;
          var label = (links[i].textContent || '').replace(/\\s+/g, ' ').trim();
          if (label && label !== 'Read the story' && label.indexOf('Read:') !== 0 && label !== 'Open on the map') return label;
        }
        return '';
      }
      function khdPageTitle() {
        var parts = khdHashParts();
        var head = parts[0] || '';
        if (!head || head === 'home' || head === 'content' || head === 'explore') return document.title;
        if (head === 'map') return 'Map';
        if (head === 'about') return 'About';
        if (head === 'app') return 'iPhone app';
        if (head === 'resources') return 'Resources';
        if (head === 'timeline' || head === 'stories' || head === 'story') {
          if (!parts[1]) return 'Timeline';
          return khdLookupStoryTitle(khdStorySlug()) || '';
        }
        return document.title;
      }
      function khdCancelTitleWait() {
        if (!khdTitleWait) return;
        window.removeEventListener('khd-story-titles', khdTitleWait.finish);
        clearTimeout(khdTitleWait.timer);
        khdTitleWait = null;
      }
      function khdSend(page_path) {
        var slug = khdStorySlug();
        var title = slug ? (khdLookupStoryTitle(slug) || 'Timeline') : khdPageTitle();
        khdLastPagePath = page_path;
        gtag('event', 'page_view', {
          page_location: location.href,
          page_path: page_path,
          page_title: title || document.title
        });
      }
      function khdPageView() {
        var page_path = location.pathname + location.search + location.hash;
        var slug = khdStorySlug();
        if (slug && !khdLookupStoryTitle(slug)) {
          if (khdLastPagePath === page_path) return;
          if (khdTitleWait && khdTitleWait.path === page_path) return;
          khdCancelTitleWait();
          var sent = false;
          function finish() {
            if (sent) return;
            sent = true;
            var still = (location.pathname + location.search + location.hash) === page_path;
            khdCancelTitleWait();
            if (!still) { khdPageView(); return; }
            khdSend(page_path);
          }
          khdTitleWait = { path: page_path, finish: finish, timer: setTimeout(finish, 2500) };
          window.addEventListener('khd-story-titles', finish);
          return;
        }
        khdCancelTitleWait();
        if (page_path === khdLastPagePath) return;
        khdSend(page_path);
      }
      khdPageView();
      window.addEventListener('hashchange', khdPageView);
      ['pushState', 'replaceState'].forEach(function (method) {
        var orig = history[method];
        history[method] = function () {
          var result = orig.apply(this, arguments);
          khdPageView();
          return result;
        };
      });
    </script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>`
}

/** Problems that should fail the dist HTML check. Empty means the page is fine. */
export function missingGaSnippet(html) {
  const problems = []
  if (!html.includes(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`)) {
    problems.push(`missing ${GA_MEASUREMENT_ID} tag`)
  }
  if (!/gtag\(\s*'consent'\s*,\s*'default'/.test(html) || !html.includes("'analytics_storage': 'denied'")) {
    problems.push('missing consent default')
  }
  if (!html.includes("'analytics_storage': 'granted'")) {
    problems.push('missing granted consent default')
  }
  if (!html.includes('wait_for_update')) problems.push('missing wait_for_update')
  if (!html.includes("'send_page_view': false")) problems.push('missing send_page_view:false')
  if (!html.includes("window.addEventListener('hashchange', khdPageView)")) {
    problems.push('missing hashchange page_view')
  }
  if (!html.includes('page_path: page_path')) problems.push('missing page_path')
  if (!html.includes('page_title:')) problems.push('missing page_title')
  for (const code of ['AT', 'IS', 'NO', 'GB', 'CH']) {
    if (!html.includes(`'${code}'`)) problems.push(`missing region ${code}`)
  }
  return problems
}

const MARKER = '<!-- khd-gtag -->'

/** Insert the shared snippet before the AdSense loader. Idempotent. */
export function injectGtagHead(html) {
  if (!missingGaSnippet(html).length) return html
  const snippet = gtagHeadHtml()
  if (html.includes(MARKER)) return html.replace(MARKER, snippet)
  const adsAt = html.indexOf('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js')
  if (adsAt !== -1) {
    const start = html.lastIndexOf('<script', adsAt)
    if (start !== -1) return `${html.slice(0, start)}${snippet}\n    ${html.slice(start)}`
  }
  return html.replace('</head>', `${snippet}\n  </head>`)
}

/** Immediate AdSense loader. The SPA and the privacy page use this. */
export const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8587137224654033'

export function adsenseLoaderHtml() {
  return `<script async src="${ADSENSE_SRC}" crossorigin="anonymous"></script>`
}

/**
 * Prerendered story, layer, and about pages have no ad slots. Load the same
 * adsbygoogle.js tag on idle or the first interaction so it does not compete
 * with LCP. Consent defaults are already queued by gtagHeadHtml().
 */
export function deferredAdsenseLoaderHtml() {
  return `<script>
    (function () {
      var src = '${ADSENSE_SRC}';
      var started = false;
      function load() {
        if (started || document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) return;
        started = true;
        var s = document.createElement('script');
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.src = src;
        document.head.appendChild(s);
      }
      window.__khdLoadAds = load;
      ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(function (name) {
        window.addEventListener(name, load, { once: true, passive: true });
      });
      if (window.requestIdleCallback) window.requestIdleCallback(function () { load(); }, { timeout: 2000 });
      else window.addEventListener('load', function () { setTimeout(load, 1); });
    })();
  </script>`
}

/** Footer control that reopens AdSense Privacy & messaging. Hidden until googlefc exists. */
export function privacyChoicesLinkHtml() {
  return `<a href="/privacy/" data-privacy-choices hidden>Privacy choices</a>`
}

export function privacyChoicesBootHtml() {
  return `<script>
    (function () {
      var links = document.querySelectorAll('[data-privacy-choices]');
      if (!links.length) return;
      function googleFcReady() {
        var fc = window.googlefc;
        return !!(fc && (fc.callbackQueue || typeof fc.showRevocationMessage === 'function'));
      }
      function openChoices(e) {
        if (window.__khdLoadAds) window.__khdLoadAds();
        if (!googleFcReady()) {
          if (location.pathname.indexOf('/privacy') === 0) e.preventDefault();
          return;
        }
        e.preventDefault();
        window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
        window.googlefc.callbackQueue.push(function () {
          googlefc.showRevocationMessage();
        });
      }
      links.forEach(function (link) { link.addEventListener('click', openChoices); });
      function reveal() {
        if (!googleFcReady()) return false;
        links.forEach(function (link) { link.hidden = false; });
        return true;
      }
      if (reveal()) return;
      var tries = 0;
      var timer = setInterval(function () {
        tries += 1;
        if (reveal() || tries > 40) clearInterval(timer);
      }, 250);
    })();
  </script>`
}
