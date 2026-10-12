/**
 * Full-screen viewer for route maps.
 * Zoom art loads only after a map is opened: theme-matched AVIF, then WebP,
 * then the 1600 WebP. Gestures are pointer, wheel, and double-click — no library.
 */
;(function () {
  if (window.__khdRouteLightbox) return
  window.__khdRouteLightbox = true

  var MAX_SCALE = 8
  var dialog = null
  var backdrop = null
  var stage = null
  var canvas = null
  var img = null
  var statusEl = null
  var statusText = null
  var spinner = null
  var closeBtn = null
  var trigger = null
  var openFrame = null
  var inerted = []
  var locked = false
  var scrollY = 0
  var scale = 1
  var tx = 0
  var ty = 0
  var loadGen = 0
  var gestured = false
  var pointers = new Map()
  var pinch = null
  var drag = null
  var downOnImage = false
  var clicksToSwallow = 0
  var lastTap = 0
  var lastTapX = 0
  var lastTapY = 0
  var lastTouchZoom = 0

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function themeMode() {
    return document.documentElement.getAttribute('data-hp-theme') === 'light' ? 'light' : 'dark'
  }

  function safeAssetUrl(value) {
    var raw = typeof value === 'string' ? value.trim() : ''
    if (!raw || /[\u0000-\u001f\u007f\\<>"'`]/.test(raw)) return ''
    if (raw.startsWith('//')) return ''
    var parsed
    try {
      parsed = new URL(raw, 'https://kyhistorydrive.com')
    } catch (err) {
      return ''
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    var allowedOrigins = ['https://kyhistorydrive.com', 'http://kyhistorydrive.com']
    var pageOrigin = typeof location !== 'undefined' && location.origin ? location.origin : ''
    var allowed = allowedOrigins.indexOf(parsed.origin) !== -1 || (pageOrigin !== '' && parsed.origin === pageOrigin)
    if (!allowed) return ''
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw
    return parsed.href
  }

  function zoomUrl(value) {
    var next = safeAssetUrl(value)
    if (next) {
      if (!/["&<>]/.test(next)) return next
    }
    return ''
  }

  function zoomChain(frame) {
    var mode = themeMode()
    var urls = []
    ;['avif', 'webp'].forEach(function (ext) {
      var url = zoomUrl(frame.getAttribute('data-zoom-' + mode + '-' + ext) || '')
      if (url && urls.indexOf(url) === -1) urls.push(url)
    })
    var fallback = zoomUrl(frame.getAttribute('data-fallback') || '')
    if (fallback && urls.indexOf(fallback) === -1) urls.push(fallback)
    return urls
  }

  function setZoomSrc(url) {
    var next = safeAssetUrl(url)
    if (next) {
      if (!/["&<>]/.test(next)) img.src = next
    }
  }

  function makeButton(label, className, extra) {
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.className = className
    if (extra) btn.setAttribute(extra.name, extra.value)
    btn.textContent = label
    return btn
  }

  function ensure() {
    if (dialog) return
    dialog = document.createElement('div')
    dialog.className = 'route-lightbox'
    dialog.id = 'route-map-lightbox'
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.hidden = true

    backdrop = document.createElement('div')
    backdrop.className = 'route-lightbox-backdrop'
    backdrop.setAttribute('data-lightbox-close', '')

    var bar = document.createElement('div')
    bar.className = 'route-lightbox-bar'

    var tools = document.createElement('div')
    tools.className = 'route-lightbox-tools'
    var zoomOut = makeButton('−', 'route-lightbox-btn', { name: 'data-zoom', value: 'out' })
    zoomOut.setAttribute('aria-label', 'Zoom out')
    var resetBtn = makeButton('Reset', 'route-lightbox-btn', { name: 'data-zoom', value: 'reset' })
    var zoomIn = makeButton('+', 'route-lightbox-btn', { name: 'data-zoom', value: 'in' })
    zoomIn.setAttribute('aria-label', 'Zoom in')
    closeBtn = makeButton('Close', 'route-lightbox-btn route-lightbox-close', { name: 'data-lightbox-close', value: '' })
    tools.append(zoomOut, resetBtn, zoomIn, closeBtn)
    bar.appendChild(tools)

    stage = document.createElement('div')
    stage.className = 'route-lightbox-stage'
    statusEl = document.createElement('div')
    statusEl.className = 'route-lightbox-status'
    statusEl.setAttribute('role', 'status')
    spinner = document.createElement('span')
    spinner.className = 'route-lightbox-spinner'
    spinner.setAttribute('aria-hidden', 'true')
    statusText = document.createElement('span')
    statusText.className = 'route-lightbox-status-text'
    statusText.textContent = 'Loading map'
    statusEl.append(spinner, statusText)

    canvas = document.createElement('div')
    canvas.className = 'route-lightbox-canvas'
    img = document.createElement('img')
    img.className = 'route-lightbox-img'
    img.alt = ''
    img.draggable = false
    img.decoding = 'async'
    canvas.appendChild(img)
    stage.append(statusEl, canvas)

    dialog.append(backdrop, bar, stage)
    document.body.appendChild(dialog)

    dialog.addEventListener('click', function (e) {
      if (e.target.closest('[data-lightbox-close]')) close()
    })
    tools.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-zoom]')
      if (!btn) return
      var kind = btn.getAttribute('data-zoom')
      if (kind === 'reset') resetView(true)
      else zoomCenter(kind === 'in' ? 1.25 : 1 / 1.25, true)
    })
    stage.addEventListener('click', function (e) {
      if (clicksToSwallow > 0) {
        clicksToSwallow -= 1
        return
      }
      var onImage = downOnImage || Boolean(e.target.closest && e.target.closest('.route-lightbox-img'))
      if (onImage) return
      close()
    })
    stage.addEventListener(
      'wheel',
      function (e) {
        if (dialog.hidden) return
        e.preventDefault()
        gestured = true
        var dy = e.deltaY
        if (e.deltaMode === 1) dy *= 16
        else if (e.deltaMode === 2) dy *= stage.clientHeight
        if (e.ctrlKey) dy *= 8
        zoomAt(e.clientX, e.clientY, scale * Math.exp(-dy * 0.002), false)
      },
      { passive: false },
    )
    stage.addEventListener('pointerdown', onPointerDown)
    stage.addEventListener('pointermove', onPointerMove)
    stage.addEventListener('pointerup', onPointerUp)
    stage.addEventListener('pointercancel', onPointerUp)
    stage.addEventListener('dblclick', function (e) {
      if (Date.now() - lastTouchZoom < 450) return
      e.preventDefault()
      gestured = true
      toggleZoom(e.clientX, e.clientY)
    })
    img.addEventListener('dragstart', function (e) {
      e.preventDefault()
    })
    window.addEventListener('resize', function () {
      if (!dialog || dialog.hidden) return
      if (!gestured) {
        scale = heightFitScale()
        tx = 0
        ty = 0
      }
      clampPan()
      apply(false)
    })
  }

  function showStatus(text, spinning) {
    statusEl.hidden = false
    statusText.textContent = text
    spinner.hidden = !spinning
  }

  function apply(animate) {
    var motion = Boolean(animate) && !reducedMotion()
    canvas.classList.toggle('is-anim', motion)
    canvas.style.transform = 'translate(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')'
    if (motion) {
      window.setTimeout(function () {
        canvas.classList.remove('is-anim')
      }, 200)
    }
  }

  function clampScale(n) {
    if (n < 1) return 1
    if (n > MAX_SCALE) return MAX_SCALE
    return n
  }

  function clampPan() {
    var sw = stage.clientWidth
    var sh = stage.clientHeight
    var iw = img.clientWidth * scale
    var ih = img.clientHeight * scale
    var maxX = Math.max(0, (iw - sw) / 2)
    var maxY = Math.max(0, (ih - sh) / 2)
    if (tx > maxX) tx = maxX
    if (tx < -maxX) tx = -maxX
    if (ty > maxY) ty = maxY
    if (ty < -maxY) ty = -maxY
  }

  function zoomAt(clientX, clientY, next, animate) {
    next = clampScale(next)
    var rect = stage.getBoundingClientRect()
    var px = clientX - rect.left - rect.width / 2
    var py = clientY - rect.top - rect.height / 2
    var lx = (px - tx) / (scale || 1)
    var ly = (py - ty) / (scale || 1)
    scale = next
    if (scale === 1) {
      tx = 0
      ty = 0
    } else {
      tx = px - lx * scale
      ty = py - ly * scale
      clampPan()
    }
    apply(animate)
  }

  function zoomCenter(factor, animate) {
    gestured = true
    var rect = stage.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, scale * factor, animate)
  }

  function resetView(animate) {
    gestured = true
    scale = 1
    tx = 0
    ty = 0
    apply(animate)
  }

  /** Portrait phones letterbox a wide map. Open it tall enough to fill the stage. */
  function heightFitScale() {
    var phonePortrait = window.matchMedia('(max-width: 699px) and (orientation: portrait)').matches
    if (!phonePortrait) return 1
    var nw = img.naturalWidth
    var nh = img.naturalHeight
    var cw = canvas.clientWidth
    var ch = canvas.clientHeight
    if (!nw || !nh || !cw || !ch) return 1
    var laidHeight = nh * Math.min(cw / nw, ch / nh)
    if (!laidHeight) return 1
    var next = ch / laidHeight
    if (next < 1.05) return 1
    if (next > MAX_SCALE) return MAX_SCALE
    return next
  }

  function toggleZoom(clientX, clientY) {
    if (scale > 1.05) resetView(true)
    else zoomAt(clientX, clientY, 2.5, true)
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    clicksToSwallow = 0
    if (e.isTrusted) {
      pointers.forEach(function (point, id) {
        if (!point.trusted) pointers.delete(id)
      })
      if (!pointers.size) pinch = null
    }
    downOnImage = Boolean(e.target.closest && e.target.closest('.route-lightbox-img'))
    try {
      stage.setPointerCapture(e.pointerId)
    } catch (err) {
      /* Synthetic events in tests may not capture. */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, trusted: Boolean(e.isTrusted) })
    if (pointers.size >= 2) {
      drag = null
      var pts = pointerList()
      pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        scale: scale,
        tx: tx,
        ty: ty,
        cx: (pts[0].x + pts[1].x) / 2,
        cy: (pts[0].y + pts[1].y) / 2,
      }
      return
    }
    drag = { x: e.clientX, y: e.clientY, tx: tx, ty: ty, moved: false, id: e.pointerId }
  }

  function pointerList() {
    var list = []
    pointers.forEach(function (p) {
      list.push(p)
    })
    return list
  }

  function onPointerMove(e) {
    if (!pointers.has(e.pointerId)) return
    var prev = pointers.get(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, trusted: prev.trusted })
    if (pointers.size >= 2 && pinch) {
      gestured = true
      var pts = pointerList()
      var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      var midX = (pts[0].x + pts[1].x) / 2
      var midY = (pts[0].y + pts[1].y) / 2
      var rect = stage.getBoundingClientRect()
      var px = midX - (rect.left + rect.width / 2)
      var py = midY - (rect.top + rect.height / 2)
      var startPx = pinch.cx - (rect.left + rect.width / 2)
      var startPy = pinch.cy - (rect.top + rect.height / 2)
      var next = clampScale(pinch.scale * (dist / pinch.dist))
      var lx = (startPx - pinch.tx) / (pinch.scale || 1)
      var ly = (startPy - pinch.ty) / (pinch.scale || 1)
      scale = next
      tx = px - lx * scale
      ty = py - ly * scale
      if (scale === 1) {
        tx = 0
        ty = 0
      } else clampPan()
      apply(false)
      return
    }
    if (!drag || drag.id !== e.pointerId || scale <= 1) return
    var dx = e.clientX - drag.x
    var dy = e.clientY - drag.y
    if (Math.hypot(dx, dy) > 4) drag.moved = true
    if (!drag.moved) return
    gestured = true
    tx = drag.tx + dx
    ty = drag.ty + dy
    clampPan()
    apply(false)
    stage.classList.add('is-panning')
  }

  function onPointerUp(e) {
    var info = pointers.get(e.pointerId)
    pointers.delete(e.pointerId)
    var wasPinch = Boolean(pinch)
    var wasDrag = drag && drag.id === e.pointerId && drag.moved
    if (pointers.size < 2) pinch = null
    if (drag && !pointers.has(drag.id)) drag = null
    stage.classList.remove('is-panning')
    if (wasPinch) clicksToSwallow = 2
    else if (wasDrag) clicksToSwallow = 1
    if (wasDrag || wasPinch) return
    if (!info || pointers.size) return
    if (e.pointerType !== 'touch' && e.pointerType !== 'mouse') return
    var now = Date.now()
    if (now - lastTap < 300 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 28) {
      lastTap = 0
      lastTouchZoom = now
      gestured = true
      clicksToSwallow = 1
      toggleZoom(e.clientX, e.clientY)
      return
    }
    lastTap = now
    lastTapX = e.clientX
    lastTapY = e.clientY
  }

  function focusables() {
    return Array.prototype.filter.call(dialog.querySelectorAll('button'), function (el) {
      return !el.disabled && !el.closest('[hidden]') && el.getClientRects().length > 0
    })
  }

  function onKey(e) {
    if (!dialog || dialog.hidden) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      zoomCenter(1.25, true)
      return
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      zoomCenter(1 / 1.25, true)
      return
    }
    if (e.key === '0') {
      e.preventDefault()
      resetView(true)
      return
    }
    if (scale > 1 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      gestured = true
      var step = 48
      if (e.key === 'ArrowLeft') tx += step
      if (e.key === 'ArrowRight') tx -= step
      if (e.key === 'ArrowUp') ty += step
      if (e.key === 'ArrowDown') ty -= step
      clampPan()
      apply(false)
      return
    }
    if (e.key !== 'Tab') return
    var list = focusables()
    if (!list.length) {
      e.preventDefault()
      return
    }
    var first = list[0]
    var last = list[list.length - 1]
    var active = document.activeElement
    if (e.shiftKey && (active === first || !dialog.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  function lockScroll() {
    if (locked) return
    locked = true
    scrollY = window.scrollY || document.documentElement.scrollTop || 0
    var gap = window.innerWidth - document.documentElement.clientWidth
    document.documentElement.classList.add('route-lightbox-open')
    document.body.style.position = 'fixed'
    document.body.style.top = '-' + scrollY + 'px'
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.paddingRight = gap > 0 ? gap + 'px' : ''
  }

  function unlockScroll() {
    if (!locked) return
    locked = false
    document.documentElement.classList.remove('route-lightbox-open')
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.left = ''
    document.body.style.right = ''
    document.body.style.paddingRight = ''
    window.scrollTo(0, scrollY)
  }

  function setInert(on) {
    if (on) {
      inerted = []
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === dialog || el.hasAttribute('inert')) return
        el.setAttribute('inert', '')
        inerted.push(el)
      })
      return
    }
    inerted.forEach(function (el) {
      el.removeAttribute('inert')
    })
    inerted = []
  }

  function startLoad(urls) {
    var gen = ++loadGen
    var index = 0
    img.classList.remove('is-ready')
    showStatus('Loading map', true)
    dialog.setAttribute('aria-busy', 'true')
    function ok() {
      if (gen !== loadGen) return
      dialog.setAttribute('aria-busy', 'false')
      statusEl.hidden = true
      window.requestAnimationFrame(function () {
        if (gen !== loadGen) return
        if (!gestured) {
          scale = heightFitScale()
          tx = 0
          ty = 0
        }
        clampPan()
        apply(false)
        img.classList.add('is-ready')
      })
    }
    function fail() {
      if (gen !== loadGen) return
      index += 1
      if (index < urls.length) {
        setZoomSrc(urls[index])
        return
      }
      dialog.setAttribute('aria-busy', 'false')
      img.classList.remove('is-ready')
      showStatus('Map could not be loaded.', false)
    }
    img.onload = ok
    img.onerror = fail
    if (!urls.length) {
      fail()
      return
    }
    if (img.getAttribute('src') === urls[0] && img.complete && img.naturalWidth) {
      ok()
      return
    }
    setZoomSrc(urls[0])
  }

  function open(frame, opener) {
    var slug = frame.getAttribute('data-route-slug') || ''
    if (!slug) return
    ensure()
    openFrame = frame
    var pic = frame.querySelector('img')
    var label = (pic && pic.getAttribute('alt')) || 'Route map'
    trigger = opener && opener.focus ? opener : frame.querySelector('.route-map-expand')
    gestured = false
    scale = 1
    tx = 0
    ty = 0
    apply(false)
    img.alt = label
    dialog.setAttribute('aria-label', label)
    dialog.hidden = false
    dialog.classList.add('is-open')
    lockScroll()
    setInert(true)
    document.addEventListener('keydown', onKey, true)
    closeBtn.focus()
    startLoad(zoomChain(frame))
  }

  function close() {
    if (!dialog || dialog.hidden) return
    openFrame = null
    loadGen += 1
    dialog.classList.remove('is-open')
    dialog.hidden = true
    dialog.removeAttribute('aria-busy')
    document.removeEventListener('keydown', onKey, true)
    pointers.clear()
    pinch = null
    drag = null
    stage.classList.remove('is-panning')
    setInert(false)
    unlockScroll()
    var back = trigger
    trigger = null
    if (back && back.isConnected && back.focus) back.focus()
  }

  new MutationObserver(function () {
    if (!dialog || dialog.hidden || !openFrame) return
    startLoad(zoomChain(openFrame))
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-hp-theme'] })

  document.addEventListener('click', function (e) {
    var frame = e.target.closest && e.target.closest('.route-map-zoom')
    if (!frame) return
    var hit = e.target.closest('.route-map-expand, img, .route-map-picture')
    if (!hit || !frame.contains(hit)) return
    e.preventDefault()
    var opener = hit.closest('.route-map-expand') || frame.querySelector('.route-map-expand')
    open(frame, opener)
  })
})()
