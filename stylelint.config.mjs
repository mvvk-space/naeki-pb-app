// Adapted from 37signals house style (basecamp/house-style). Their config
// targets SCSS (stylelint-config-recommended-scss, made lax); we ship plain
// CSS + Tailwind v4, so the equivalent here is stylelint-config-recommended
// with Tailwind's at-rules allowed — same "recommended, a little lax" spirit.
/** @type {import('stylelint').Config} */
export default {
  extends: "stylelint-config-recommended",
  reportNeedlessDisables: true,
  rules: {
    "at-rule-no-unknown": [ true, {
      ignoreAtRules: [
        "tailwind",
        "theme",
        "source",
        "utility",
        "variant",
        "custom-variant",
        "apply",
        "reference",
        "config",
        "plugin"
      ]
    } ]
  },
  ignoreFiles: [
    "dist/**",
    "out/**",
    "release/**",
    "coverage/**",
    "src/public/**"
  ]
}