(function(){
  var root=document.documentElement, KEY='ks-theme';
  var SUN='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  var MOON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  function isDark(){return root.getAttribute('data-theme')==='dark';}
  document.addEventListener('DOMContentLoaded',function(){
    var tb=document.getElementById('theme-toggle');
    function label(){ if(tb){tb.innerHTML=isDark()?SUN:MOON; tb.setAttribute('aria-label',isDark()?'Switch to light mode':'Switch to dark mode');}}
    label();
    tb&&tb.addEventListener('click',function(){var n=isDark()?'light':'dark';root.setAttribute('data-theme',n);try{localStorage.setItem(KEY,n)}catch(e){};label();});
    var mb=document.getElementById('menu-toggle'), nav=document.getElementById('nav');
    mb&&mb.addEventListener('click',function(){var o=nav.classList.toggle('open');mb.setAttribute('aria-expanded',o);});
    var C=window.KLEINSPAN||{checkout:{},prices:{}};
    document.querySelectorAll('[data-price]').forEach(function(el){var p=C.prices&&C.prices[el.dataset.price]; if(p) el.textContent='A$'+p;});
    document.querySelectorAll('[data-buy]').forEach(function(el){
      var u=(C.checkout||{})[el.dataset.buy];
      if(u && /^https:\/\//.test(u)){el.href=u;el.removeAttribute('aria-disabled');el.textContent='Buy now';el.rel='noopener';}
      else{el.removeAttribute('href');el.setAttribute('aria-disabled','true');el.textContent='Coming soon';}
    });
    document.querySelectorAll('[data-signup]').forEach(function(el){
      if(C.signupUrl && /^https:\/\//.test(C.signupUrl)){el.href=C.signupUrl;el.hidden=false;} else {el.hidden=true;}
    });
    document.querySelectorAll('[data-contact]').forEach(function(el){
      if(C.contactEmail){el.innerHTML='';var a=document.createElement('a');a.href='mailto:'+C.contactEmail;a.textContent=C.contactEmail;el.appendChild(a);}
    });
    var y=document.getElementById('yr'); if(y) y.textContent=new Date().getFullYear();
    // cookieless Cloudflare Web Analytics, only when a site token is set in config.js
    if(C.analyticsToken && /^[a-f0-9]{32}$/.test(C.analyticsToken)){var b=document.createElement('script');b.defer=true;b.src='https://static.cloudflareinsights.com/beacon.min.js';b.setAttribute('data-cf-beacon',JSON.stringify({token:C.analyticsToken}));document.head.appendChild(b);}
  });
})();
