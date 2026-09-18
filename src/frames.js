/// <reference path="./types.d.ts" />
/* NAEKI SHOWCASE — frame engine (turbo-frames-style live includes).

   Landing-page regions are declared in HTML as mounts:
     <div data-frame="featured"></div>
   Each frame name maps to a renderer registered from app.js, which sources
   its content from the data layer (data.js). Frames re-render whenever the
   data layer publishes a topic the frame listens to:
     "refresh" — business data refreshed (hours edited, feed polled, …)
     "tick"    — minute boundary (open/closed flips at closing time)

   htmx-style swap: every re-render fades in (hx-fade flavor) with a class
   toggle — CSP-safe, and `prefers-reduced-motion` kills the animation in
   CSS so the DOM behaviour is identical either way. The result: the landing
   page is a composition of live includes over the same data the app views
   use — edit a closing time or a review in the data layer and every frame
   re-sources itself. No view code changes. */

window.NaekiFrames = (() => {
  "use strict"

  const registry = new Map()   // frame name -> { topics: [...], render(el, D) }

  function define(name, config) {
    registry.set(name, config)
  }

  function renderEl(el, D) {
    const name = el.dataset.frame
    const frame = registry.get(name)
    if (!frame) { console.warn("NaekiFrames: no renderer for", name); return }
    try { frame.render(el, D) }
    catch (e) { console.error("NaekiFrames: render failed for", name, e) }
  }

  /** htmx-style settle: after a swap, fade the frame's new content in.
      Class-swap only (CSP forbids inline style attributes); the flash of
      re-running the enter animation on first paint is harmless — it's a
      260ms fade, and it reads as the frame "arriving". */
  function settle(el) {
    el.classList.remove("frame-in")
    void el.offsetWidth                      // style flush so the class re-runs
    el.classList.add("frame-in")
  }

  /** scan the document, render every mount once, wire its topic subscriptions */
  function mount(root = document) {
    const D = window.NaekiData
    root.querySelectorAll("[data-frame]").forEach(el => {
      const elH = /** @type {HTMLElement} */ (el)
      renderEl(elH, D)
      settle(elH)
      const frame = registry.get(elH.dataset.frame)
      if (!frame) return;
      (frame.topics || [ "refresh" ]).forEach(topic => {
        D.subscribe(topic, () => { renderEl(elH, D); settle(elH) })
      })
    })
  }

  return { define, mount }
})()
