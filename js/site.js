(function(){
  var root=document.documentElement, KEY='ks-theme';
  try{var t=localStorage.getItem(KEY); if(t) root.setAttribute('data-theme',t);}catch(e){}
  function isDark(){var a=root.getAttribute('data-theme'); return a? a==='dark' : matchMedia('(prefers-color-scheme: dark)').matches;}
  document.addEventListener('DOMContentLoaded',function(){
    var tb=document.getElementById('theme-toggle');
    function label(){ if(tb){tb.textContent=isDark()?'☀':'☾'; tb.setAttribute('aria-label',isDark()?'Switch to light mode':'Switch to dark mode');}}
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
  });
})();
