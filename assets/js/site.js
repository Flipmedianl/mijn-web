const mobileQuery=matchMedia('(max-width:800px)');
const clamp=n=>Math.max(0,Math.min(1,n));

class FrameSequence{
  constructor(section){
    this.section=section;this.canvas=section.querySelector('canvas');this.ctx=this.canvas.getContext('2d',{alpha:false,desynchronized:true});
    this.from=Number(section.dataset.frameFrom);this.to=Number(section.dataset.frameTo);this.cache=new Map();this.inflight=new Map();this.last=-1;this.active=false;this.direction=1;this.lastProgress=0;this.maxDecoded=mobileQuery.matches?10:18;
    this.resize();this.load(this.from,true).then(()=>this.draw(this.from));
    new IntersectionObserver(([entry])=>{this.active=entry.isIntersecting;if(this.active)this.update(true)},{rootMargin:'100% 0px'}).observe(section);
  }
  path(frame){return `${mobileQuery.matches?'frames-mobile':'frames'}/frame-${String(frame).padStart(3,'0')}.webp`}
  async load(frame,priority=false){
    if(frame<this.from||frame>this.to)return null;
    if(this.cache.has(frame)){const image=this.cache.get(frame);this.cache.delete(frame);this.cache.set(frame,image);return image}
    if(this.inflight.has(frame))return this.inflight.get(frame);
    const task=new Promise(resolve=>{const image=new Image();image.decoding='async';image.fetchPriority=priority?'high':'low';image.onload=async()=>{try{await image.decode()}catch{}this.inflight.delete(frame);this.cache.set(frame,image);this.trim();resolve(image)};image.onerror=()=>{this.inflight.delete(frame);resolve(null)};image.src=this.path(frame)});this.inflight.set(frame,task);return task;
  }
  trim(){let guard=0;while(this.cache.size>this.maxDecoded&&guard++<this.cache.size){const oldest=this.cache.keys().next().value;if(oldest===this.last){const keep=this.cache.get(oldest);this.cache.delete(oldest);this.cache.set(oldest,keep);continue}const image=this.cache.get(oldest);image.src='';this.cache.delete(oldest)}}
  resize(){const dpr=Math.min(devicePixelRatio||1,mobileQuery.matches?1.15:1.6);this.canvas.width=Math.round(innerWidth*dpr);this.canvas.height=Math.round(innerHeight*dpr);this.last=-1;if(this.active)this.update(true)}
  draw(frame){const image=this.cache.get(frame);if(!image||!image.naturalWidth)return false;const w=this.canvas.width,h=this.canvas.height,scale=Math.max(w/image.naturalWidth,h/image.naturalHeight),dw=image.naturalWidth*scale,dh=image.naturalHeight*scale;this.ctx.fillStyle='#f4efe5';this.ctx.fillRect(0,0,w,h);this.ctx.drawImage(image,(w-dw)/2,(h-dh)/2,dw,dh);this.last=frame;return true}
  nearest(frame){if(this.draw(frame))return;for(let d=1;d<=6;d++){if(this.draw(frame-d)||this.draw(frame+d))return}}
  prefetch(frame){const ahead=mobileQuery.matches?3:5,behind=2;const run=()=>{for(let n=1;n<=ahead;n++)this.load(frame+n*this.direction);for(let n=1;n<=behind;n++)this.load(frame-n*this.direction)};if('requestIdleCallback'in window)requestIdleCallback(run,{timeout:180});else setTimeout(run,40)}
  update(force=false){if(!this.active&&!force)return;const rect=this.section.getBoundingClientRect(),travel=Math.max(1,this.section.offsetHeight-innerHeight),progress=clamp(-rect.top/travel);this.direction=progress>=this.lastProgress?1:-1;this.lastProgress=progress;const frame=Math.round(this.from+progress*(this.to-this.from));if(frame!==this.last){this.nearest(frame);this.load(frame,true).then(()=>{if(frame===Math.round(this.from+this.lastProgress*(this.to-this.from)))this.draw(frame)});this.prefetch(frame)}const hero=this.section.querySelector('.hero');if(hero){const fade=Math.min(1,progress/.28);hero.style.opacity=String(1-fade);hero.style.transform=mobileQuery.matches?`translateY(${-fade*18}px)`:`translateY(calc(-50% - ${fade*28}px))`}}
}

const sequences=[...document.querySelectorAll('[data-sequence]')].map(section=>new FrameSequence(section));
const scale=document.querySelector('#scale'),scaleVideo=scale.querySelector('.lazy-video'),scaleOverlay=scale.querySelector('.overlay2');
let scaleActive=false,scaleSeeking=false,scaleTarget=0;
const loadVideo=video=>{if(video.src)return;video.src=video.dataset.src;video.load()};
new IntersectionObserver(([entry])=>{if(entry.isIntersecting)loadVideo(scaleVideo)},{rootMargin:'125% 0px'}).observe(scale);
new IntersectionObserver(([entry])=>{scaleActive=entry.isIntersecting;if(scaleActive)requestUpdate()},{rootMargin:'25% 0px'}).observe(scale);
function updateScale(){if(!scaleActive)return;const rect=scale.getBoundingClientRect(),travel=Math.max(1,scale.offsetHeight-innerHeight),progress=clamp(-rect.top/travel),fade=clamp((progress-.08)/.18);scaleOverlay.style.opacity=String(fade);scaleOverlay.style.transform=mobileQuery.matches?`translateY(${(1-fade)*24}px)`:`translateY(calc(-50% + ${(1-fade)*30}px))`;if(scaleVideo.duration&&Number.isFinite(scaleVideo.duration)){scaleTarget=progress*Math.max(0,scaleVideo.duration-.02);if(!scaleSeeking&&Math.abs(scaleVideo.currentTime-scaleTarget)>.035){scaleSeeking=true;scaleVideo.currentTime=scaleTarget;const done=()=>{scaleSeeking=false};scaleVideo.addEventListener('seeked',done,{once:true});setTimeout(done,120)}}}

const avatar=document.querySelector('#avatar'),model=document.querySelector('#model'),floaters=[...avatar.querySelectorAll('.float-card')];
let avatarActive=false,modelStarted=false;
async function startModel(){if(modelStarted)return;modelStarted=true;model.src=model.dataset.src;try{await import('https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js');if(!mobileQuery.matches)model.setAttribute('camera-controls','');model.addEventListener('load',()=>avatar.classList.add('avatar-ready'),{once:true})}catch{avatar.classList.add('avatar-fallback')}}
new IntersectionObserver(([entry])=>{if(entry.isIntersecting)startModel()},{rootMargin:mobileQuery.matches?'35% 0px':'75% 0px'}).observe(avatar);
new IntersectionObserver(([entry])=>{avatarActive=entry.isIntersecting;if(avatarActive)requestUpdate()},{rootMargin:'20% 0px'}).observe(avatar);
function updateAvatar(){if(!avatarActive)return;const rect=avatar.getBoundingClientRect(),travel=Math.max(1,avatar.offsetHeight-innerHeight),progress=clamp(-rect.top/travel);if(modelStarted&&!mobileQuery.matches)model.cameraOrbit=`${-34+progress*68}deg ${78-progress*4}deg auto`;floaters.forEach((card,index)=>card.style.setProperty('--av',clamp((progress-(.1+index*.06))/.18)))}

let ticking=false;
function update(){ticking=false;sequences.forEach(sequence=>sequence.update());updateScale();updateAvatar()}
function requestUpdate(){if(!ticking){ticking=true;requestAnimationFrame(update)}}
addEventListener('scroll',requestUpdate,{passive:true});
addEventListener('resize',()=>{sequences.forEach(sequence=>sequence.resize());requestUpdate()},{passive:true});
scaleVideo.addEventListener('loadedmetadata',requestUpdate,{once:true});
const revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('seen');revealObserver.unobserve(entry.target)}}),{rootMargin:'0px 0px -12% 0px',threshold:.08});
document.querySelectorAll('.reveal').forEach(element=>revealObserver.observe(element));
if(matchMedia('(prefers-reduced-motion:reduce)').matches)document.querySelectorAll('.reveal').forEach(element=>element.classList.add('seen'));
requestUpdate();
