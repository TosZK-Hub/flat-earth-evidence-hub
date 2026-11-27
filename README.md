# Kleinspan

Leer Afrikaans met Hettie, an online Afrikaans course (in `learn/`) for adult and teen learners, with a marketing landing page at the root.
Live: https://leer.allesafrikaans.com/

**Printables paused (28 Nov 2026, Jesse):** the printable packs are hidden. `shop.html`, `bundel.html`, `alfabet.html`, `getalle.html`, `kleure-en-vorms.html` and `free.html` are now noindex redirect stubs to `/learn/`, and the free sample PDF was removed from `downloads/`. The full printable pages, PDF and copy are in git history before the lessons-first PR (main `0e19203`) and in `/workspace/backups/kleinspan-pre-lessons-first-20261128-0653.tgz` on the build box. `js/config.js` prices/checkout keys and `img/mock-*`/`img/inside-*` art are left in place for when they return.

Static site on GitHub Pages. No build step, no tracking.

- `index.html` (course landing page), `about.html`, `faq.html`, `privacy.html`, `terms.html`, `404.html`
- `css/tokens.css` brand palette and type tokens · `css/fonts.css` self-hosted Fraunces, Nunito, Andika (OFL) · `css/style.css`
- `img/*.svg` photos and illustrations (WebP inside SVG wrappers) · `img/ill.svg#name` illustration sprite
- `js/config.js` checkout links, prices, sign-up and contact settings. Buy buttons say "Coming soon" until a checkout URL is a real https:// link.
- `learn/` is the separate course app. Do not edit from the shop build.

Before launch: Jesse to confirm the copy marked `PLACEHOLDER` in the HTML (home note, about page, course blurb), the vocab list and prices. Privacy and terms need legal review. See `LAUNCH.md`.
