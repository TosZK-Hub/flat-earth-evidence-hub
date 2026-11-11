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

## Price history and keep-or-sell (history.js, signal.js)
Every point on the chart is a dated price from a named source. Nothing is filled in or invented.

| Source | What it gives | Cost |
|---|---|---|
| OPTCG API `/card/twoweeks/` | One Piece: about 14 daily TCGplayer market prices per variant (DayN = N days before `date_scraped`; checked against TCGCSV archives) | Free |
| TCGdex pricing | Pokémon: Cardmarket 1/7/30-day averages + trend (EUR), TCGplayer low/mid/market/high (USD). Momentum only, **no signal** | Free |
| On-device log | Today's free prices saved on the phone each day you open a card (never TCG Prices AU data) | Free |
| JustTCG (key in Settings) | Up to 1 year of daily TCGplayer NM prices, Pokémon and One Piece | Free tier 1,000 calls/mo (personal use); Starter US$19/mo |
| TCG Prices AU (via proxy) | eBay Australia individual sales, raw vs graded, up to 365 days of history (`/au-history`) | Basic A$9.99/mo |

**Signal method.** It fits a straight line to log(price) over the look-back window (default 90 days). Volatility σ is the standard deviation of daily log changes. The projection over H days (default 30, never longer than the history) is last × e^(trend·H), with a band of ± z·σ·√H (z = 1.28, about 80%).
- **Hold** or **Sell** shows only when the projected move is bigger than your threshold (default ±10%) and bigger than normal noise (σ·√H). Otherwise it shows **Watch**.
- **No signal** shows when the history has fewer than 20 points, spans less than 30 days, or its latest price is more than 21 days old.
- Confidence is Low or Medium, never High.
- All of these settings can be changed under "Signal assumptions".

This is an estimate, not financial advice.
