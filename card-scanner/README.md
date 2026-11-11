# CardLens AU: card scanner prototype

Phone web app (PWA): point the rear camera at a Pokémon or One Piece card. It reads the collector number / card code with on-device OCR (Tesseract.js), looks the card up, and shows the market price in USD/EUR plus an **AUD estimate** with an editable buy/sell calculator.

Free data sources, no keys:
- Pokémon: [TCGdex](https://tcgdex.dev) (primary, includes TCGplayer + Cardmarket prices), [Pokémon TCG API](https://pokemontcg.io) (fallback)
- One Piece: [OPTCG API](https://optcgapi.com) (TCGplayer market prices)
- FX: [Frankfurter](https://frankfurter.dev) (ECB reference rates)

Pure HTML/CSS/JS, no build step. `core.js` holds parsing, lookup and pricing logic and also runs in Node for tests.

Not financial advice. AUD figures are estimates converted from US/EU marketplace prices, not Australian sold prices.
