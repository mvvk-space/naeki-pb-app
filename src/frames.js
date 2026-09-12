/* NAEKI SHOWCASE — frame engine (turbo-frames-style live includes).

   Landing-page regions are declared in HTML as mounts:
     <div data-frame="featured"></div>
   Each frame name maps to a renderer registered from app.js, which sources
   its content from the data layer (data.js). Frames re-render whenever the
   data layer publishes a topic the frame listens to:
     "refresh" — business data refreshed (hours edited, feed polled, …)
     "tick"    — minute boundary (open/closed flips at closing time)

   The result: the landing page is a composition of live includes over the
   same data the app views use — edit a closing time or a review in the data
   layer and every frame re-sources itself. No view code changes. */

window.NaekiFrames = (() => {
  "use strict";

  const registry = new Map();   // frame name -> { topics: [...], render(el, D) }

  function define(name, config) {
    registry.set(name, config);
  }

  function renderEl(el, D) {
    const name = el.dataset.frame;
    const frame = registry.get(name);
    if (!frame) { console.warn("NaekiFrames: no renderer for", name); return; }
    try { frame.render(el, D); }
    catch (e) { console.error("NaekiFrames: render failed for", name, e); }
  }

  /** scan the document, render every mount once, wire its topic subscriptions */
  function mount(root = document) {
    const D = window.NaekiData;
    root.querySelectorAll("[data-frame]").forEach(el => {
      renderEl(el, D);
      const frame = registry.get(el.dataset.frame);
      if (!frame) return;
      (frame.topics || ["refresh"]).forEach(topic => {
        D.subscribe(topic, () => renderEl(el, D));
      });
    });
  }

  return { define, mount };
})();