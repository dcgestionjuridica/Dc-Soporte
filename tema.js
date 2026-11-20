// Aplica el modo (oscuro, claro o automático) antes de pintar, para que no parpadee.
(function(){var m='auto';try{m=localStorage.getItem('dcsoporte-tema')||'auto'}catch(e){}
var t=m==='auto'?(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'claro':'oscuro'):m;
document.documentElement.setAttribute('data-tema',t);
if(window.top!==window.self){try{window.top.location=window.self.location}catch(e){document.documentElement.style.display='none'}}})();
