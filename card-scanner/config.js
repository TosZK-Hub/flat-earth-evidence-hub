// Holowise — the ONLY file Jesse edits to switch on payments, the proxy, affiliate links and launch sign-ups.
// Nothing here is secret: checkout links, store/product/variant IDs, a Worker URL and an EPN campaign ID are public by design.
// NEVER put API keys here (JustTCG, TCG Prices AU, Lemon Squeezy API key). Those go in the Worker as secrets (proxy/README.md).
// Every blank value keeps today's behaviour: buy buttons stay disabled, prices come from the free sources, eBay links are plain.
export const PAY = {
  provider: 'lemonsqueezy',
  // 1) Lemon Squeezy → Products → each variant → Share → copy the checkout link (https://<store>.lemonsqueezy.com/buy/<uuid>).
  //    A button only becomes clickable when its own link is filled in and starts with https://.
  checkout: { proMonthly: '', proYearly: '', dealerMonthly: '', dealerYearly: '' },
  // 2) Numeric IDs from Lemon Squeezy (Settings → Stores for the store ID; Products → ⋯ → Copy ID for products/variants).
  //    Keys from another store or product are rejected; variant IDs decide Pro vs Dealer.
  store: { storeId: null, productIds: [] },        // e.g. storeId: 12345, productIds: [111, 222]
  variants: { pro: [], dealer: [] },               // e.g. pro: [333, 444] (monthly, yearly), dealer: [555, 666]
  licenseApi: '',                                  // leave blank: uses PROXY.url + '/license' if set, else Lemon Squeezy directly
  activationName: 'Holowise phone',                // label shown in Lemon Squeezy for each activated device
  prices: { proMonthly: 6.99, proYearly: 49, dealerMonthly: 19.99, dealerYearly: 179, currency: 'AUD' }, // display only; must match Lemon Squeezy
  trialDays: 7
};
// 3) Your Cloudflare Worker (proxy/worker.js), e.g. 'https://holowise-proxy.<your-subdomain>.workers.dev'.
//    When set: price history comes from the server's JustTCG plan (no key needed on phones), AU eBay solds from TCG Prices AU
//    (if its secret is set), and licence checks go through the Worker. A URL typed in Settings on a device overrides this.
export const PROXY = { url: '' };
// 4) eBay Partner Network campaign ID (10 digits, EPN → Campaigns). Blank = plain eBay AU links and no affiliate notice.
export const AFFILIATE = { epnCampaignId: '', epnRotationAU: '705-53470-19255-0', customId: 'holowise' };
// 5) Launch sign-ups: paste a free form link (Tally, Google Forms) and/or a contact email. Blank = the button says sign-ups aren't open.
export const LAUNCH = { interestUrl: '', contactEmail: '', businessName: 'Holowise', abn: '' };
