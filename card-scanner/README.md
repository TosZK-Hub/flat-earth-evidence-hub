# CardLens AU: card scanner prototype

Phone web app (PWA). Point the rear camera at a Pokémon or One Piece card to identify it, then see the market price, an AUD figure and an editable buy/sell calculator.

## How it identifies cards
1. **Ximilar image recognition** (`ximilar.js`, primary, optional). Paste a Ximilar API token in **Settings**. It's kept in localStorage on that device only and never committed. Calls `POST https://api.ximilar.com/collectibles/v2/tcg_id` directly from the browser (Ximilar sends CORS headers, so no proxy is needed). Optional graded-slab detection (`slab_id` + `slab_grade`) and `price_stats`. Requires a Ximilar plan that includes Collectibles recognition.
2. **On-device OCR** (`ocr.js`, free fallback). Tesseract.js with a multi-pass pipeline: contrast stretch → One Piece code crop → adaptive threshold (light and dark text) with sharpening → italic de-shear → small rotations. Each number read is checked against the APIs, and against the OCR'd card name, before it's accepted.

## Data sources (free, no keys)
- Pokémon: [TCGdex](https://tcgdex.dev) (primary, TCGplayer and Cardmarket prices), [Pokémon TCG API](https://pokemontcg.io) (fallback)
- One Piece: [OPTCG API](https://optcgapi.com) (TCGplayer market prices)
- FX: [Frankfurter](https://frankfurter.dev) (ECB reference rates)
- AU sold prices: optional, via [TCG Prices AU](https://tcgprices.com.au) through your own proxy (`proxy/`). Their key can't be used client-side.

Pure HTML/CSS/JS, no build step. `core.js`, `ocr.js`, `ximilar.js` and `au.js` also run in Node for tests (`test/`, kept off the site).

Not financial advice. Prices labelled "converted" are estimates from US/EU marketplaces, not Australian sales.
