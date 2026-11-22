/* Kleinspan shop settings. Fill these in to switch things on.
   Buy buttons stay "Coming soon" until a product's checkout URL is a real https:// link.
   PRICES ARE PLACEHOLDERS (A$) for Jesse to confirm before launch. */
window.KLEINSPAN = {
  checkout: {
    alfabet: '',   // Stripe Payment Link for Alphabet A–Z, e.g. https://buy.stripe.com/...
    getalle: '',   // Numbers 1–20
    kleure:  '',   // Colours & shapes
    bundel:  ''    // Starter bundle (all three)
  },
  prices: { alfabet: 7, getalle: 6, kleure: 5, bundel: 15 }, // AUD, placeholder
  signupUrl: '',     // optional: newsletter sign-up form link (e.g. a hosted form). Hidden until set.
  contactEmail: '',  // shown on FAQ / privacy / terms once set
  analyticsToken: '5f0ff7e915304b2c9914d092684ac893' // Cloudflare Web Analytics site token (public, not a secret). Cookieless. Empty = off.
};
