# Optional AU price proxy (Cloudflare Worker)

Not deployed. Only needed if you want **Australian eBay sold prices** from [TCG Prices AU](https://tcgprices.com.au) inside the app.

Why a proxy: TCG Prices AU's [API terms](https://tcgprices.com.au/api-terms) say the key must not go in public or client-side code. The Worker keeps the key server-side and adds CORS for the site.

Cost: TCG Prices AU free keys are paused (Nov 2026). Basic is A$9.99/month for 1,000 requests. Cloudflare Workers has a free tier (100k requests/day).

## Routes
- `GET /au-price?q=…&graded=true|false` returns current AU sold median and individual listings (`/api/v1/price`, country AU).
- `GET /au-history?q=<name set>&number=<n>&days=<1-365>` looks up the card id with `/api/v1/search` (matching on card number), then calls `/api/v1/price-history`. It returns `{cardId, history, soldHistory}`, which the app uses for the price history chart and the recent-sales list.

Each card view costs about 3 TCG Prices AU requests (price + search + history). Edge caching (6 h) cuts repeats. Basic plan: 1,000 requests/month.

## Deploy (about 5 minutes)
1. Get a TCG Prices AU key: https://tcgprices.com.au/api-docs
2. `npm i -g wrangler && wrangler login`
3. In this folder: `wrangler init cardlens-au-proxy --no-git` (or create a Worker in the dashboard) and use `worker.js` as the entry.
4. `wrangler secret put TCGPRICES_API_KEY` (paste the key)
5. Optional: set var `ALLOWED_ORIGIN=https://toszk-hub.github.io`
6. `wrangler deploy`, then copy the `https://….workers.dev` URL into the app under **Settings → AU price proxy URL**.

Terms reminders: credit "Prices from TCG Prices AU" next to the data (the app does), cache for 24 h at most (Worker: 6 h), and don't store the data long-term (the app never saves AU prices to My scans).

Ximilar needs no proxy: its API sends CORS headers for the site origin, so the browser calls it directly with the token from Settings.
