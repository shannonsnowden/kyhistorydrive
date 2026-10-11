# Security headers

Amplify Hosting attaches these response headers at the CloudFront edge. They are not set by Vite, and they do not change page layout, so they do not add cumulative layout shift.

The same `customHeaders` list is in two files, and the build fails if the lists diverge:

- `customHttp.yml` is the file current Amplify Hosting applies. It overrides headers typed into the Amplify console.
- `amplify.yml` carries that same list beside the existing rewrite rules, including the `/about` → `/about/` 301.

Cache-Control, CORS, and Content-Type rules that were already on `/data/app/*.json`, `ads.txt`, `robots.txt`, the sitemaps, `/privacy`, `/about`, `/videos`, and caption `.vtt` files are unchanged. Security headers are repeated on every pattern, including `**`. A more specific pattern is its own edge behavior and does not inherit `**`.

`Content-Security-Policy-Report-Only` reports violations in the browser console. It does not block a script, image, map tile, film, or ad. There is no enforcing `Content-Security-Policy` header.

## Headers on every response

| Header | Value |
| --- | --- |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| X-Frame-Options | `SAMEORIGIN` |
| Content-Security-Policy-Report-Only | The policy below |

HSTS is one year and covers subdomains. It does not include `preload`. Do not add `preload` until the site has served this header without issues and someone intends to submit the domain to the preload list.

`X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'` both keep other sites from embedding Kentucky History Drive. The CSP directive is the one current browsers follow. The older header covers browsers that ignore `frame-ancestors`.

### Permissions-Policy

`camera`, `microphone`, `payment`, and `usb` are disabled. Nothing in the site asks for them.

`geolocation` is also disabled (`geolocation=()`). A search of `src/`, `public/`, and `scripts/` found no `geolocation`, `getCurrentPosition`, or `watchPosition` use. The map is a MapLibre view of Kentucky, not the visitor's GPS. If a later feature calls the Geolocation API, change this to `geolocation=(self)` before that feature ships.

## What the page actually loads

The policy was written from the source and from the published data the browser fetches. Outbound links (Kentucky Historical Society, Wikipedia articles, restaurant sites, and the rest of the research list) are navigations. They are not resource loads, so they are not listed.

Published story and layer photos are files under `/content/photos/`. These source URLs are still in `scripts/story-photo-curated.json` or `scripts/layer-photo-curated.json` and are not requested by the published site, so they are not allowed:

- `thumb.wikimedia.org`
- `commons.wikimedia.org` `Special:FilePath` image URLs
- `www.bagdadrollermillsfeed.com`
- `elevation.nationalmap.gov`

`commons.wikimedia.org` is allowed for `connect-src` only, because the story sidebar calls the Commons API. That call does not use the wiki page as an image.

## Allowed origins

A host written as `https://*.example.com` matches one subdomain label (`www`, `region1`, `pagead2`, `tiles-a`). It does not match the bare domain. Bare domains that the site calls are listed on their own.

### Scripts (`script-src`)

| Source | Why |
| --- | --- |
| `'self'` | The Vite bundle. |
| `'unsafe-inline'` | Inline scripts already in the HTML: logo rotation, theme, the GA4 consent bootstrap, the privacy-choices boot, and the deferred AdSense loader. Amplify custom headers are static, so they cannot stamp a matching nonce on each response. |
| `'unsafe-eval'` | The AdSense loader. Google's own AdSense CSP example includes `'unsafe-eval'`. |
| `https://*.googletagmanager.com` | `https://www.googletagmanager.com/gtag/js?id=G-83G4SBQKT1`, injected on every HTML page. |
| `https://pagead2.googlesyndication.com` | `adsbygoogle.js` in the page head (`ca-pub-8587137224654033`). |
| `https://tpc.googlesyndication.com` | Further scripts that `adsbygoogle.js` loads. |
| `https://fundingchoicesmessages.google.com` | Funding Choices, the Google CMP behind AdSense Privacy & messaging (`window.googlefc`, including the privacy-choices link). |
| `https://googleads.g.doubleclick.net` | Ad scripts that run with the ad frame. |
| `https://*.gstatic.com` | Static scripts those tags load from `www.gstatic.com`. |
| `https://adservice.google.com` | AdSense ad-service script. |

### Styles (`style-src`)

| Source | Why |
| --- | --- |
| `'self'` | The bundled stylesheet. Fonts are system fonts, so `font-src` falls through to `default-src 'self'`. |
| `'unsafe-inline'` | MapLibre and AdSense set style attributes and inject `<style>` elements. |

### Images (`img-src`)

| Source | Why |
| --- | --- |
| `'self'`, `data:`, `blob:` | Local photos, icons, and images MapLibre builds in the page. |
| `https://*.google-analytics.com` | GA4 measurement pixels. This wildcard includes `www.google-analytics.com` and `region1.google-analytics.com`. |
| `https://*.googletagmanager.com` | Google tag pixels. |
| `https://*.googlesyndication.com` | Ad images from `pagead2.googlesyndication.com` and `tpc.googlesyndication.com`. |
| `https://*.g.doubleclick.net` | Ad images from `googleads.g.doubleclick.net` and `securepubads.g.doubleclick.net`. |
| `https://*.gstatic.com` | Ad and CMP images. |
| `https://fundingchoicesmessages.google.com` | CMP message images. |
| `https://www.google.com` | Images the Google tag and ad frames request from www. |
| `https://basemaps.cartocdn.com` and `https://*.basemaps.cartocdn.com` | CARTO Voyager. Raster tiles, when `VITE_CARTO_API_KEY` is set, are `a.basemaps.cartocdn.com`, `b`, and `c`. The vector style's sprite is `tiles.basemaps.cartocdn.com`. There is no separate CARTO API host in the source. The API key is a query parameter on those tile URLs. |
| `https://upload.wikimedia.org` | Thumbnails returned by the Wikipedia REST summary API and the Commons API, then used as `<img src>`. |
| `https://media.historypin.org` | Historic-photo grids. `public/data/historic-photos.json` and `public/data/site-historic-photos.json` still hotlink this host. |
| `https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com` | The Mary Ingles film poster. |

### Connections (`connect-src`)

| Source | Why |
| --- | --- |
| `'self'` | Stories, GeoJSON, the search index, and other same-origin fetches. |
| `https://*.google-analytics.com` | GA4 collect. Includes `www.google-analytics.com` and `region1.google-analytics.com`. |
| `https://region1.google-analytics.com` | Named on its own so the regional GA4 endpoint is visible in the header, not only inside the wildcard. |
| `https://analytics.google.com` and `https://*.analytics.google.com` | The other GA4 collect hosts, including a regional `analytics.google.com` subdomain. |
| `https://*.googletagmanager.com` | Google tag configuration requests. |
| `https://*.googlesyndication.com` | Beacons from `pagead2.googlesyndication.com` and `tpc.googlesyndication.com`. |
| `https://*.g.doubleclick.net` | Ad beacons. |
| `https://fundingchoicesmessages.google.com` | CMP configuration. |
| `https://adservice.google.com` | Ad service requests. |
| `https://*.gstatic.com` | Includes `csi.gstatic.com`, which the ad tag calls. |
| `https://*.adtrafficquality.google` | Ad traffic-quality calls from `ep1.adtrafficquality.google` and `ep2.adtrafficquality.google`. |
| `https://www.google.com` | Google tag collect requests that go to www. |
| `https://basemaps.cartocdn.com` and `https://*.basemaps.cartocdn.com` | Voyager `style.json`, `tiles.json`, vector tiles (`tiles-a` through `tiles-d.basemaps.cartocdn.com`), and glyph `.pbf` files. Same CARTO hosts as the images. No `api.carto.com` call. |
| `https://en.wikipedia.org` | `api/rest_v1/page/summary` when a story looks up a Wikipedia thumbnail. |
| `https://commons.wikimedia.org` | `w/api.php` image search for the same lookup. |

### Media (`media-src`)

| Source | Why |
| --- | --- |
| `'self'` and `blob:` | Same-origin media, plus a blob URL if the player uses one. |
| `https://kyhistorydrive-videos.s3.us-east-1.amazonaws.com` | `pilot-full.mp4` and `pilot-vertical.mp4` for Follow the River Home. Captions are a same-origin `.vtt`, not this bucket. |

### Frames (`frame-src`)

| Source | Why |
| --- | --- |
| `'self'` | Same-origin frames only, if a page ever adds one. |
| `https://*.g.doubleclick.net` | The ad iframe on `googleads.g.doubleclick.net`. |
| `https://*.googlesyndication.com` | Ad frames on `pagead2.googlesyndication.com` and `tpc.googlesyndication.com`, including the sodar frame. |
| `https://fundingchoicesmessages.google.com` | The Funding Choices / CMP consent iframe. |
| `https://www.google.com` | Ad frames Google serves from www. |
| `https://*.adtrafficquality.google` | Ad traffic-quality frames (`ep1`, `ep2`). |

### Workers and document limits

| Directive | Why |
| --- | --- |
| `worker-src 'self' blob:` | MapLibre starts its tile worker from a blob URL. |
| `frame-ancestors 'self'` | Only this site may embed its pages. |
| `object-src 'none'` | No plugins, and no `<object>` or `<embed>` loads. |
| `base-uri 'self'` | An injected `<base>` cannot retarget relative URLs. |
| `form-action 'self'` | The site search form stays on this origin. |
| `default-src 'self'` | Anything not listed above has to come from this site. |

## Switch to an enforcing CSP later

Do this only after the report-only header has been live and the pages below have been checked with the browser console open. Report-only will keep working through that review. An enforcing policy with a missing host will blank the map, the film, a historic photo, GA4, or AdSense.

1. Load `/`, `/#map`, a story that shows historic photos, `/videos/`, and `/privacy/`. In an EEA, UK, or Switzerland session, also confirm the Funding Choices message can open. Note every `Content-Security-Policy-Report-Only` violation.
2. Add a host only when the page actually needs it. Google adds AdSense hosts over time. Their AdSense help says a fixed allowlist is not the CSP they support long term. The supported AdSense policy is a per-request nonce plus `'strict-dynamic'`. Amplify's custom headers are a static string, so they cannot do that. A nonce means a later edge change (a CloudFront Function or Lambda@Edge) that stamps the same nonce on the header and on every inline script. That is a separate project. Until then, this allowlist is the policy.
3. When those pages are quiet, copy this value to a `Content-Security-Policy` header and leave `Content-Security-Policy-Report-Only` in place for one deploy so new violations are still reported. Then remove the report-only header.
4. Retest GA4 (`G-83G4SBQKT1` still sends `page_view`), AdSense (the loader still runs; reserved slots still do not shift layout), the map canvas, and the film. Keep HSTS without `preload` in that change.

Enforcing this allowlist blocks unexpected origins. It does not, by itself, stop an injected inline script, because `'unsafe-inline'` and `'unsafe-eval'` stay until the nonce work in step 2 exists.
