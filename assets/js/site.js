import {CinematicChapter} from './cinematic.js?v=1';
const mobileQuery = matchMedia('(max-width:800px)');
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
const clamp = n => Math.max(0, Math.min(1, n));
let raf=0;
function requestUpdate(){if(!raf&&!document.hidden)raf=requestAnimationFrame(update);}
function progress(section){return clamp(-section.getBoundingClientRect().top/Math.max(1,section.offsetHeight-section.firstElementChild.clientHeight));}
const chapters=[...document.querySelectorAll('[data-chapter]')].map(section=>new CinematicChapter(section,{mobileQuery,reducedMotion}));

const avatar = document.querySelector('#avatar'), model = document.querySelector('#model');
const floaters = [...avatar.querySelectorAll('.float-card')];
let avatarNear=false, avatarActive=false, avatarModule, avatarController, avatarGeneration=0;
function loadAvatar() {
  if (!avatarNear || document.hidden || avatarController || avatarModule) return;
  const generation = ++avatarGeneration;
  avatarModule = import('./avatar.js?v=8').then(async ({mountAvatar}) => {
    if (!avatarNear || document.hidden || generation !== avatarGeneration) return;
    avatarController = await mountAvatar(avatar, model, mobileQuery.matches, () => avatarNear && !document.hidden && generation === avatarGeneration);
    if (!avatarNear || document.hidden || generation !== avatarGeneration) { avatarController?.dispose(); avatarController=null; }
    requestUpdate();
  }).catch(() => avatar.classList.add('avatar-fallback')).finally(() => { avatarModule=null; if (generation !== avatarGeneration) loadAvatar(); });
}
new IntersectionObserver(([e]) => {
  avatarNear=e.isIntersecting;
  if (avatarNear) loadAvatar(); else { avatarGeneration++; avatarController?.dispose(); avatarController=null; }
  requestUpdate();
}, {rootMargin:'35% 0px'}).observe(avatar);
new IntersectionObserver(([e]) => { avatarActive=e.isIntersecting; requestUpdate(); }).observe(avatar);
function updateAvatar() {
  if (!avatarActive) return;
  const p = progress(avatar);
  avatarController?.update(reducedMotion.matches ? .5 : p);
  floaters.forEach((card,i) => card.style.setProperty('--av', reducedMotion.matches ? 1 : clamp((p-(.1+i*.06))/.18)));
}
function update(){raf=0;updateAvatar();}
addEventListener('scroll',requestUpdate,{passive:true});
addEventListener('resize',requestUpdate,{passive:true});
mobileQuery.addEventListener('change',()=>{avatarGeneration++;avatarController?.dispose();avatarController=null;loadAvatar();requestUpdate();});
reducedMotion.addEventListener('change',requestUpdate);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cancelAnimationFrame(raf);raf=0;avatarGeneration++;avatarController?.dispose();avatarController=null;}
  else {loadAvatar();requestUpdate();}
});
const revealObserver = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('seen'); revealObserver.unobserve(e.target); }
}), {rootMargin:'0px 0px -8% 0px',threshold:.08});
document.querySelectorAll('.reveal').forEach(e=>revealObserver.observe(e));
requestUpdate();

// Opt-in local diagnostics; nothing is uploaded.
if(new URLSearchParams(location.search).has('audit'))window.flipmediaDiagnostics=()=>({chapters:chapters.map(c=>c.snapshot()),avatar:avatar.className});
