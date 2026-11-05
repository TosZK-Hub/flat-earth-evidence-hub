(function(){var r=document.documentElement;try{var s=localStorage.getItem('theme');if(s)r.dataset.theme=s}catch(e){}
document.addEventListener('DOMContentLoaded',function(){var b=document.getElementById('theme-toggle');if(b)b.onclick=function(){var t=r.dataset.theme==='light'?'dark':'light';r.dataset.theme=t;try{localStorage.setItem('theme',t)}catch(e){}};
document.querySelectorAll('input[type=checkbox][data-k]').forEach(function(c){var k='sk-'+c.dataset.k;c.checked=localStorage.getItem(k)==='1';c.onchange=function(){localStorage.setItem(k,c.checked?'1':'0')}});});})();
