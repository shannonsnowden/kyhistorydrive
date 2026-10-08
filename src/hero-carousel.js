/**
 * Featured-story carousel.
 * Autoplay waits 12 seconds, does not start at 600px and below, and does not
 * start when the visitor prefers reduced motion. Hover and focus pause it.
 * A Pause/Play button next to the dots holds that choice.
 * The outgoing headline finishes fading out before the next one fades in.
 */
export class HeroCarousel {
  static INTERVAL_MS = 12000
  static COPY_MS = 320
  static NARROW_QUERY = '(max-width: 600px)'
  static REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

  static #root = null
  static #slides = []
  static #els = []
  static #dots = []
  static #status = null
  static #button = null
  static #index = 0
  static #timer = 0
  static #fadeTimer = 0
  static #token = 0
  /** null follows the autoplay rules; true/false is an explicit Play/Pause. */
  static #explicit = null
  static #pointerHold = false
  static #focusHold = false
  static #onSlide = null
  static #pageWired = false

  static mount(root, slides, { onSlide } = {}) {
    if (!root || !Array.isArray(slides) || slides.length < 2) return
    this.#root = root
    this.#slides = slides
    this.#els = [...root.querySelectorAll('.hp-hero-slide')]
    this.#dots = [...root.querySelectorAll('.hp-hero-dot')]
    this.#status = document.getElementById('hpHeroStatus')
    this.#button = root.querySelector('[data-hero-playback]')
    this.#index = Math.max(0, this.#els.findIndex((el) => el.classList.contains('is-active')))
    this.#explicit = null
    this.#pointerHold = false
    this.#focusHold = false
    this.#onSlide = typeof onSlide === 'function' ? onSlide : null
    this.#token += 1
    this.#stop()
    if (this.#fadeTimer) {
      clearTimeout(this.#fadeTimer)
      this.#fadeTimer = 0
    }
    root.setAttribute('aria-roledescription', 'carousel')
    this.#wire(root)
    this.announce(this.#index)
    this.sync()
  }

  static prefersReducedMotion() {
    return window.matchMedia(this.REDUCE_QUERY).matches
  }

  static narrow() {
    return window.matchMedia(this.NARROW_QUERY).matches
  }

  /** Whether the timer should advance slides when nothing is holding it. */
  static wantsPlay() {
    if (this.prefersReducedMotion()) return false
    if (this.#explicit === true) return true
    if (this.#explicit === false) return false
    return !this.narrow()
  }

  static held() {
    return this.#pointerHold || this.#focusHold
  }

  static sync() {
    this.#paintButton()
    if (this.wantsPlay() && !this.held() && !document.hidden) this.#start()
    else this.#stop()
  }

  /**
   * Move to a slide. The current headline fades out first so the two titles
   * are never on screen together.
   */
  static show(next, { announceChange = true } = {}) {
    const count = this.#els.length
    if (!count) return
    const target = ((next % count) + count) % count
    const token = ++this.#token
    if (this.#fadeTimer) {
      clearTimeout(this.#fadeTimer)
      this.#fadeTimer = 0
    }
    const apply = () => {
      if (token !== this.#token) return
      this.#fadeTimer = 0
      this.#index = target
      this.#els.forEach((el, i) => {
        const on = i === target
        el.classList.toggle('is-active', on)
        el.classList.remove('is-copy-out')
        el.setAttribute('aria-hidden', on ? 'false' : 'true')
        if (on) el.removeAttribute('inert')
        else el.setAttribute('inert', '')
      })
      this.#dots.forEach((dot, i) => {
        const on = i === target
        dot.classList.toggle('is-active', on)
        dot.setAttribute('aria-current', on ? 'true' : 'false')
      })
      const title = this.#els[target]?.querySelector('h2')
      if (title?.id) this.#root?.setAttribute('aria-labelledby', title.id)
      this.#onSlide?.(this.#slides[target], target)
      if (announceChange) this.announce(target)
    }
    if (target === this.#index) {
      apply()
      return
    }
    const wait = this.prefersReducedMotion() ? 0 : this.COPY_MS
    if (wait === 0) {
      apply()
      return
    }
    this.#els[this.#index]?.classList.add('is-copy-out')
    this.#fadeTimer = window.setTimeout(apply, wait)
  }

  static announce(i) {
    if (!this.#status) return
    const story = this.#slides[i]
    if (!story) return
    this.#status.textContent = `Story ${i + 1} of ${this.#slides.length}: ${story.title}`
  }

  static #start() {
    this.#stop()
    if (this.prefersReducedMotion()) return
    this.#timer = window.setInterval(() => this.show(this.#index + 1), this.INTERVAL_MS)
  }

  static #stop() {
    if (!this.#timer) return
    clearInterval(this.#timer)
    this.#timer = 0
  }

  static #paintButton() {
    const btn = this.#button
    if (!btn) return
    const playing = this.wantsPlay()
    const label = playing ? 'Pause' : 'Play'
    btn.textContent = label
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false')
    btn.setAttribute('aria-label', playing ? 'Pause featured stories' : 'Play featured stories')
    if (this.prefersReducedMotion()) {
      btn.setAttribute('aria-disabled', 'true')
      btn.title = 'Autoplay stays off while reduced motion is on'
    } else {
      btn.removeAttribute('aria-disabled')
      btn.removeAttribute('title')
    }
  }

  static #wire(root) {
    root.querySelectorAll('[data-hero-dir]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.show(this.#index + Number(btn.dataset.heroDir || 0))
        this.sync()
      })
    })
    this.#dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        this.show(Number(dot.dataset.heroTo || 0))
        this.sync()
      })
    })
    this.#button?.addEventListener('click', () => {
      if (this.prefersReducedMotion()) return
      const play = !this.wantsPlay()
      this.#explicit = play
      if (play) {
        this.#pointerHold = false
        this.#focusHold = false
      }
      this.sync()
    })
    root.addEventListener('mouseenter', () => {
      this.#pointerHold = true
      this.sync()
    })
    root.addEventListener('mouseleave', () => {
      this.#pointerHold = false
      this.sync()
    })
    root.addEventListener('focusin', (e) => {
      this.#focusHold = !e.target.closest?.('[data-hero-playback]')
      this.sync()
    })
    root.addEventListener('focusout', (e) => {
      if (!root.contains(e.relatedTarget)) {
        this.#focusHold = false
        this.sync()
      }
    })
    if (this.#pageWired) return
    this.#pageWired = true
    document.addEventListener('visibilitychange', () => this.sync())
    window.matchMedia(this.NARROW_QUERY).addEventListener('change', () => this.sync())
    window.matchMedia(this.REDUCE_QUERY).addEventListener('change', () => this.sync())
  }
}
