(function(){var b=document.getElementById('theme-toggle'),r=document.documentElement;if(!b)return;
b.addEventListener('click',function(){var t=r.dataset.theme==='light'?'dark':'light';r.dataset.theme=t;try{localStorage.setItem('theme',t)}catch(e){}});})();
