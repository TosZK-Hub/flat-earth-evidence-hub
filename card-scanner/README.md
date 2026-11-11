# Holowise: card scanner & value (v5)

Phone web app (PWA). Point the rear camera at a Pokémon or One Piece card. Holowise finds the card edges, captures it when it's steady, identifies it, and shows the market price, an AUD estimate, a buy/sell calculator and a deal verdict. (Earlier versions were called CardLens AU.)

## What's in v5
- **App shell**: bottom tabs (Scan · Collection · Watchlist · Settings), card sheet, dark/light/system theme, haptics (Android), skeleton loading, 3-step onboarding that also sets up the JustTCG key.
- **Auto-scan** (`detect.js`): a custom Sobel-edge card detector (no OpenCV) runs on a 180 px thumbnail about 9× a second, draws the card outline, and auto-captures when the card has been steady for 4 frames. After a capture it waits for the card to change before capturing again. OCR uses two reused Tesseract workers (number + name in parallel) and a lower-resolution first pass.
- **Batch mode** for dealers: each scan adds to a session list with a running market total and a buy-offer total (the calculator's max buy). Export it as CSV or add it all to the Collection.
- **Deal mode** (`deal.js`): type the asking price for a Great deal / Fair / Collector price / Overpriced verdict against your fee-aware net and max buy, plus the trend signal. These are estimates.
- **Collection** (`portfolio.js`, `db.js`): quantity, condition, grade, price paid, date, your own value (for graded cards). Shows AUD value, profit/loss per card and in total, a value chart from daily snapshots, top movers, and CSV import/export. Everything is stored in IndexedDB on the device.
- **Watchlist** (`budget.js`): buy/sell targets. On open it refreshes prices from the free sources, then JustTCG (7-day change and signal) within a budget that keeps 25 calls a day in reserve for scanning. A usage meter reads JustTCG's own `_metadata`. Hits are highlighted, with a tab badge and app badge, and a notification while the app is open (no server, so no background push).
- Icons: the GitHub connector used for deploys is text-only, so the PNG icons (`icons/mkicons.py`) are embedded as data URIs in the manifest and `index.html`. `icons/icon.svg` is the vector icon.

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
