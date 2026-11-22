# Kleinspan

Afrikaans printables for little ones, wherever home is. A static HTML/CSS/JS shop for print-at-home Afrikaans/English learning packs (alphabet, numbers 1–20, colours and shapes), aimed at South African families in Australia, New Zealand, the UK and beyond.

Live: https://toszk-hub.github.io/flat-earth-evidence-hub/ (GitHub Pages, legacy repo name; update `sitemap.xml`, `robots.txt` and canonical links if the repo is renamed or a custom domain is added).

## Structure
- `index.html`, `shop.html`, `free.html`, `about.html`, `faq.html`, `privacy.html`, `terms.html`, `404.html`
- `css/style.css`: mobile-first, light/dark (follows system, with a toggle)
- `js/config.js`: checkout links, placeholder prices, optional sign-up link and contact email. Buy buttons show "Coming soon" until a real `https://` checkout link is set.
- `js/site.js`: theme toggle, mobile menu, buy-button switch-on
- `img/`: product preview images (SVG, watermarked) and favicon
- `downloads/kleinspan-gratis-proefpakkie.pdf`: the free sample (the only PDF in this repo)

Paid PDFs are deliberately **not** in this repository. See `LAUNCH.md` for go-live steps.

Replaced Solo Kit AU on 2026-11-22.
