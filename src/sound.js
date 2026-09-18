/* NAEKI SHOWCASE — sound + haptics.
   Tiny WebAudio-synthesized UI sounds (no audio assets — everything is
   oscillators/noise buffers, so CSP and offline cost nothing) plus
   navigator.vibrate on mobile. Respect one device preference:
   NaekiStore.get().sound (default ON, set via the sidebar "Sounds" toggle).
   Every entry point is a click handler, so the lazy AudioContext resume
   satisfies autoplay policy. Audio must never break ordering — everything
   is guarded and failures are silent. */
window.NaekiSound = (() => {
  "use strict"

  let ctx = null

  function ac() {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    if (!ctx) ctx = new AC()                     // first call is always inside a user gesture
    if (ctx.state === "suspended") ctx.resume().catch(() => {})
    return ctx
  }

  /** preference gate — store absent (tests/early boot) → default ON */
  function enabled() {
    const s = window.NaekiStore && window.NaekiStore.get()
    return !s || s.sound !== false
  }

  /* one-shot envelope helper: node → gain → destination, exp decay, cleanup */
  function blip(c, node, peak, dur) {
    const g = c.createGain()
    g.gain.setValueAtTime(peak, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    node.connect(g).connect(c.destination)
    node.onended = () => { try { node.disconnect(); g.disconnect() } catch { /* audio is best-effort; never break the flow */ } }
  }

  /** short white-noise buffer, bandpass-shaped inside the caller */
  function noise(c, dur) {
    const len = Math.max(1, Math.floor(c.sampleRate * dur))
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    return src
  }

  /* a tiny two-oscillator chime helper: freq sweep + harmonic, exp decay.
     Every melody in the kit is just a timed stack of these. */
  function tone(c, freq, at, dur, peak, type = "sine") {
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, c.currentTime + at)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, c.currentTime + at)
    g.gain.exponentialRampToValueAtTime(peak, c.currentTime + at + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur)
    osc.connect(g).connect(c.destination)
    osc.start(c.currentTime + at)
    osc.stop(c.currentTime + at + dur + 0.02)
    osc.onended = () => { try { osc.disconnect(); g.disconnect() } catch { /* audio is best-effort; never break the flow */ } }
  }

  /** wood-block tick — cart add. High sine ping + a 50ms bandpassed noise tap. */
  function tick() {
    if (!enabled()) return
    const c = ac(); if (!c) return
    try {
      const osc = c.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, c.currentTime)
      osc.frequency.exponentialRampToValueAtTime(660, c.currentTime + 0.06)
      blip(c, osc, 0.12, 0.07)
      osc.start(); osc.stop(c.currentTime + 0.08)

      const n = noise(c, 0.05)
      const bp = c.createBiquadFilter()
      bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 9
      n.connect(bp)
      blip(c, bp, 0.25, 0.05)
      n.start()
    } catch { /* audio is best-effort; never break the flow */ }
  }

  /** stamp thump — low sweep + thudded noise, pairs with the stamp-pop CSS */
  function punch() {
    if (!enabled()) return
    const c = ac(); if (!c) return
    try {
      const osc = c.createOscillator()
      osc.type = "sine"
      osc.frequency.setValueAtTime(160, c.currentTime)
      osc.frequency.exponentialRampToValueAtTime(55, c.currentTime + 0.12)
      blip(c, osc, 0.5, 0.14)
      osc.start(); osc.stop(c.currentTime + 0.15)

      const n = noise(c, 0.08)
      const lp = c.createBiquadFilter()
      lp.type = "lowpass"; lp.frequency.value = 700
      n.connect(lp)
      blip(c, lp, 0.3, 0.08)
      n.start()
    } catch { /* audio is best-effort; never break the flow */ }
  }

  /* ---------------- new entries (same guards, same envelope style) -------- */

  /** redeem — a two-note rising "coin" arpeggio: 660 → 990 Hz. */
  function redeem() {
    if (!enabled()) return
    const c = ac(); if (!c) return
    try {
      tone(c, 660, 0, 0.09, 0.16)
      tone(c, 990, 0.09, 0.14, 0.16)
      tone(c, 1320, 0.16, 0.18, 0.1)
    } catch { /* audio is best-effort; never break the flow */ }
  }

  /** checkout — the register: tick-tick + a bright E-major triad bloom. */
  function checkout() {
    if (!enabled()) return
    const c = ac(); if (!c) return
    try {
      const n = noise(c, 0.05)
      const bp = c.createBiquadFilter()
      bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 10
      n.connect(bp)
      blip(c, bp, 0.18, 0.05)
      n.start();
      [ 659.25, 830.61, 987.77 ].forEach((f, i) => tone(c, f, 0.09 + i * 0.055, 0.32, 0.12, "triangle"))
      tone(c, 1318.5, 0.24, 0.4, 0.06, "sine")
    } catch { /* audio is best-effort; never break the flow */ }
  }

  /** bell arrival — one strike: 1245 Hz + a soft shimmer partial, decays ~0.5s. */
  function bell() {
    if (!enabled()) return
    const c = ac(); if (!c) return
    try {
      tone(c, 1244.5, 0, 0.5, 0.1)
      tone(c, 1869, 0.004, 0.35, 0.04)
      const n = noise(c, 0.04)
      const bp = c.createBiquadFilter()
      bp.type = "bandpass"; bp.frequency.value = 3200; bp.Q.value = 12
      n.connect(bp)
      blip(c, bp, 0.06, 0.04)
      n.start()
    } catch { /* audio is best-effort; never break the flow */ }
  }

  /** milestone claim — five-note pentatonic run (do–re–mi–sol–do). */
  function milestone() {
    if (!enabled()) return
    const c = ac(); if (!c) return
    try {
      [ 523.25, 587.33, 659.25, 783.99, 1046.5 ].forEach((f, i) =>
        tone(c, f, i * 0.07, 0.22, 0.11, "triangle"))
    } catch { /* audio is best-effort; never break the flow */ }
  }

  /** navigation — 10ms airy tap, ~60% volume of tick; cheap enough to fire on
      every view swap without getting annoying. */
  function pop() {
    if (!enabled()) return
    const c = ac(); if (!c) return
    try {
      tone(c, 520, 0, 0.05, 0.07)
      tone(c, 700, 0.018, 0.04, 0.05)
    } catch { /* audio is best-effort; never break the flow */ }
  }

  /** sign-in success — the shop's door chime: two soft triangles, rising. */
  function chime() {
    if (!enabled()) return
    const c = ac(); if (!c) return
    try {
      tone(c, 880, 0, 0.3, 0.12, "triangle")
      tone(c, 1174.7, 0.12, 0.42, 0.1, "triangle")
    } catch { /* audio is best-effort; never break the flow */ }
  }

  /** haptics — no-op where unsupported (desktop Chromium); never throws */
  function vibrate(pattern) {
    try { navigator.vibrate && navigator.vibrate(pattern) } catch { /* audio is best-effort; never break the flow */ }
  }

  return { tick, punch, redeem, checkout, bell, milestone, pop, chime, vibrate, enabled }
})()
