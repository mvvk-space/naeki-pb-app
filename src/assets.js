/// <reference path="./types.d.ts" />
/* NAEKI SHOWCASE — NaekiArt: the shared inline-SVG art library.
   One place for the decorative SVG bits surfaces sprinkle in (mascot,
   basket, sleeping bell, starburst, rolling ball, PAID stamp) so views
   don't hand-roll their own paths. Every piece is pure line-art in the
   brand palette (stroke = currentColor unless noted) and CSP-safe —
   injected as markup strings, never inline <style> or <script>.
   Decorative: callers render these inside aria-hidden containers. */
window.NaekiArt = (() => {
  "use strict"

  /* the onigiri mascot, line-art: body + nori band + gold salmon dot.
     Groups carry ids only inside the instance (suffix-free) — these are
     hand-drawn paths, viewBox 64×60, stroke inherits currentColor. */
  const ONIGIRI = `
    <svg class="naeki-art onigiri" viewBox="0 0 64 60" fill="none"
         stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="art-body" d="M32 6 Q35.5 2.5 39 6 L56 44 Q58.5 51 51 51 L13 51 Q5.5 51 8 44 Z"/>
      <rect class="art-nori" x="24" y="35" width="16" height="13" rx="3.5"/>
      <circle class="art-dot" cx="22.5" cy="17" r="3"/>
      <circle class="art-dot" cx="41.5" cy="17" r="3"/>
      <path class="art-smile" d="M28.5 27 Q32 30.5 35.5 27"/>
    </svg>`

  /* empty basket: two woven arcs + handle — the cart's zero-state */
  const BASKET = `
    <svg class="naeki-art basket" viewBox="0 0 72 56" fill="none"
         stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M10 22 H62 L56.5 48 Q55.7 52 51.5 52 H20.5 Q16.3 52 15.5 22 Z" transform="translate(0,0)"/>
      <path d="M15.5 22 Q16.3 16 20.5 16 H51.5 Q55.7 16 56.5 22" stroke-width="0"/>
      <path d="M24 14 Q36 2 48 14"/>
      <path d="M22 30 H50 M24 38 H48 M28 46 H44" opacity="0.5"/>
    </svg>`

  /* sleeping bell: the offer inbox's zero-state — bell on its side, Zzz */
  const BELL_SLEEP = `
    <svg class="naeki-art bell-sleep" viewBox="0 0 72 60" fill="none"
         stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M26 34 a11 11 0 0 1 22 0 v7 h5 a2 2 0 0 1 0 5 H21 a2 2 0 0 1 0 -5 h5 z" transform="rotate(-14 36 40)"/>
      <path d="M32.5 51.5 a4 4 0 0 0 8 0" transform="rotate(-14 36 40)"/>
      <path class="art-zzz" d="M52 14 h7 l-7 8 h7" stroke-width="2.5"/>
      <path class="art-zzz z2" d="M62 4 h5 l-5 6 h5" stroke-width="2.5"/>
    </svg>`

  /* starburst: five-point sparkle for claim/checkout moments */
  const STAR = `
    <svg class="naeki-art star" viewBox="-16 -16 32 32" aria-hidden="true">
      <path d="M0 -14 Q2 -2 14 0 Q2 2 0 14 Q-2 2 -14 0 Q-2 -2 0 -14 Z" fill="currentColor"/>
    </svg>`

  /* rolling ball: the checkout's "order rolling out" beat (spins via CSS) */
  const BALL = `
    <svg class="naeki-art ball" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5"/>
      <path d="M12 3.5 v4 M12 16.5 v4 M3.5 12 h4 M16.5 12 h4" opacity="0.55"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
    </svg>`

  /* PAID stamp: diagonal, draw-on via pathLength (pairs with the receipt) */
  const STAMP_PAID = `
    <svg class="naeki-art stamp-paid" viewBox="0 0 120 64" fill="none"
         stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect class="art-draw" pathLength="1" x="6" y="10" width="108" height="44" rx="8"/>
      <path class="art-draw" pathLength="1" d="M22 32 l8 -9 m0 0 l8 9 m-8 -9 v16"/>
      <path class="art-draw" pathLength="1" d="M48 23 v18 m0 -9 h9 m-9 0 a4.5 4.5 0 1 0 9 0 a4.5 4.5 0 1 0 -9 0 M65 23 l6 18 6 -18"/>
      <text x="88" y="38" text-anchor="middle" fill="currentColor" stroke="none"
            font-size="13" font-weight="700" letter-spacing="1" class="art-draw-text">PAID</text>
    </svg>`

  /* chopsticks + grain: the "order ahead" pickup moment */
  const PICKUP = `
    <svg class="naeki-art pickup" viewBox="0 0 64 40" fill="none"
         stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M6 32 L58 12 M6 36 L58 20"/>
      <circle cx="18" cy="15" r="5" opacity="0.7"/>
      <circle cx="30" cy="10.5" r="5" opacity="0.45"/>
    </svg>`

  return { ONIGIRI, BASKET, BELL_SLEEP, STAR, BALL, STAMP_PAID, PICKUP }
})()
