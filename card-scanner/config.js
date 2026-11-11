// Holowise — business settings Jesse fills in. Nothing here is secret: payment links and IDs are public by design.
// Until CHECKOUT links are set, the upgrade screen says checkout isn't live and never takes payment.
export const PAY = {
  provider: 'lemonsqueezy',          // 'lemonsqueezy' (license keys built in) or 'stripe' (Payment Links + license from your Worker)
  checkout: {                        // paste your Lemon Squeezy / Stripe Payment Link URLs here
    proMonthly: '', proYearly: '', dealerMonthly: '', dealerYearly: ''
  },
  licenseApi: '',                    // e.g. https://your-worker.workers.dev/license  (proxy/worker.js route). Blank = call Lemon Squeezy directly.
  store: { storeId: null, productIds: [] },      // Lemon Squeezy store/product IDs to accept (anti key-reuse check)
  variants: { pro: [], dealer: [] }, // Lemon Squeezy variant IDs that map to each tier
  prices: { proMonthly: 6.99, proYearly: 49, dealerMonthly: 19.99, dealerYearly: 179, currency: 'AUD' },
  trialDays: 7
};
// eBay Partner Network: put your EPN campaign ID here to earn commission on eBay AU links. Blank = plain links.
export const AFFILIATE = { epnCampaignId: '', epnRotationAU: '705-53470-19255-0', customId: 'holowise' };
