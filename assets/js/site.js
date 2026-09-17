const mobileQuery = matchMedia('(max-width:800px)');
const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)');
const constrained = navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || '');
const clamp = n => Math.max(0, Math.min(1, n));
let raf = 0, previousTime = 0;
function requestUpdate() {
  if (!raf && !document.hidden) raf = requestAnimationFrame(update);
}

// One shared budget, even when the page grows to many sequences.
class FramePool {
  constructor() { this.jobs = new Map(); this.running = 0; }
  reconcile(owner, frames) {
    const wanted = new Set(frames);
    for (const [key, job] of this.jobs) {
      if (job.owner === owner && !wanted.has(job.frame)) {
        if (job.started) job.controller.abort(); else this.jobs.delete(key);
      }
    }
    frames.forEach((frame, priority) => {
      if (owner.cache.has(frame) || (owner.failed.get(frame) || 0) > performance.now()) return;
      const key = `${owner.id}:${owner.version}:${frame}`;
      if (this.jobs.has(key)) { this.jobs.get(key).priority = priority; return; }
      this.jobs.set(key, {key, owner, frame, priority, version:owner.version, controller:new AbortController()});
    });
    this.pump();
  }
  pump() {
    const limit = constrained ? 2 : mobileQuery.matches ? 3 : 4;
    while (this.running < limit) {
      const job = [...this.jobs.values()].filter(j => !j.started).sort((a,b) => a.priority-b.priority)[0];
      if (!job) break;
      job.started = true; this.running++;
      this.run(job).finally(() => { this.jobs.delete(job.key); this.running--; this.pump(); requestUpdate(); });
    }
  }
  async run(job) {
    const {owner, frame, controller, version} = job;
    let image;
    try {
      const response = await fetch(owner.path(frame), {signal:controller.signal, cache:'force-cache', priority:job.priority < 2 ? 'high':'low'});
      if (!response.ok) throw new Error(`Frame ${response.status}`);
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if ('createImageBitmap' in window) image = await createImageBitmap(blob);
      else {
        const url = URL.createObjectURL(blob);
        try { image = new Image(); image.src = url; await image.decode(); } finally { URL.revokeObjectURL(url); }
      }
      if (controller.signal.aborted || version !== owner.version) { image.close?.(); return; }
      owner.cache.set(frame, image); owner.trim();
    } catch (error) {
      image?.close?.();
      if (error.name !== 'AbortError') owner.failed.set(frame, performance.now()+5000);
    }
  }
}
const pool = new FramePool();
let sequenceId = 0;
class FrameSequence {
  constructor(section) {
    this.id = sequenceId++; this.section = section; this.canvas = section.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d', {alpha:false, desynchronized:true});
    this.from = +section.dataset.frameFrom; this.to = +section.dataset.frameTo;
    this.cache = new Map(); this.failed = new Map(); this.version = 0;
    this.mobile = mobileQuery.matches; this.active = false; this.near = false;
    this.current = this.target = this.from; this.last = -1; this.direction = 1;
    this.hero = section.querySelector('.hero');
    new ResizeObserver(() => { this.resize(); requestUpdate(); }).observe(this.canvas);
    new IntersectionObserver(([e]) => {
      this.near = e.isIntersecting;
      if (!this.near) { pool.reconcile(this, []); this.release(); }
      requestUpdate();
    }, {rootMargin:'50% 0px'}).observe(section);
    new IntersectionObserver(([e]) => { this.active = e.isIntersecting; requestUpdate(); }).observe(section);
  }
  path(frame) {
    const directory = this.mobile ? (this.section.dataset.framesMobile || 'frames-mobile') : (this.section.dataset.frames || 'frames');
    return `${directory}/frame-${String(frame).padStart(3,'0')}.webp`;
  }
  release() { for (const image of this.cache.values()) image.close?.(); this.cache.clear(); }
  resize() {
    if (this.mobile !== mobileQuery.matches) {
      pool.reconcile(this, []); this.version++; this.mobile = mobileQuery.matches; this.release(); this.failed.clear(); this.last = -1;
    }
    const dpr = Math.min(devicePixelRatio || 1, this.mobile ? 1.25 : 1.5);
    const width = Math.round(this.canvas.clientWidth*dpr), height = Math.round(this.canvas.clientHeight*dpr);
    if (width === this.canvas.width && height === this.canvas.height) return;
    // ResizeObserver follows the stable sticky box, not the moving mobile address bar.
    delete this.canvas.dataset.frame; this.canvas.width = width; this.canvas.height = height; this.last = -1;
    this.drawNearest(Math.round(this.current));
  }
  trim() {
    const budget = (this.mobile ? 32 : 64)*1024*1024;
    let bytes = [...this.cache.values()].reduce((n,i) => n+i.width*i.height*4, 0);
    const order = [...this.cache.keys()].sort((a,b) => Math.abs(b-this.current)-Math.abs(a-this.current));
    for (const key of order) {
      if (bytes <= budget) break;
      if (key === this.last) continue;
      const image = this.cache.get(key); bytes -= image.width*image.height*4; image.close?.(); this.cache.delete(key);
    }
  }
  draw(frame) {
    const image = this.cache.get(frame);
    if (!image || !this.ctx) return false;
    if (frame === this.last) return true;
    const w = this.canvas.width, h = this.canvas.height, scale = Math.max(w/image.width,h/image.height);
    this.ctx.drawImage(image, (w-image.width*scale)/2, (h-image.height*scale)/2, image.width*scale,image.height*scale);
    this.last = frame; this.canvas.dataset.frame = frame; return true;
  }
  drawNearest(frame) {
    if (this.draw(frame)) return;
    const nearest = [...this.cache.keys()].sort((a,b) => Math.abs(a-frame)-Math.abs(b-frame))[0];
    if (nearest !== undefined) this.draw(nearest);
  }
  update(dt) {
    if (!this.near || document.hidden) return false;
    const p = progress(this.section), target = reducedMotion.matches ? this.from : this.from+p*(this.to-this.from);
    if (target !== this.target) this.direction = target > this.target ? 1 : -1;
    this.target = target;
    // Restore the original gradual frame traversal, normalized for refresh rate.
    const delta = target-this.current, step = (this.mobile ? 1.35 : 1.8)*dt/(1000/60);
    this.current += Math.sign(delta)*Math.min(Math.abs(delta), step);
    const frame = Math.round(this.current), end = Math.round(target);
    const frames = [frame, end];
    if (!reducedMotion.matches) {
      const ahead = constrained ? 4 : this.mobile ? 12 : 9;
      for (let n=1;n<=ahead;n++) frames.push(frame+n*this.direction);
      for (let n=1;n<=3;n++) frames.push(frame-n*this.direction);
    }
    pool.reconcile(this, [...new Set(frames)].filter(f => f>=this.from && f<=this.to));
    this.drawNearest(frame);
    if (this.hero) {
      const fade = reducedMotion.matches ? 0 : clamp(p/.28);
      this.hero.style.opacity = 1-fade;
      this.hero.style.transform = this.mobile ? `translateY(${-fade*18}px)` : `translateY(calc(-50% - ${fade*28}px))`;
      this.hero.inert = fade === 1;
    }
    return this.active && Math.abs(target-this.current)>.01;
  }
}
function progress(section) {
  return clamp(-section.getBoundingClientRect().top / Math.max(1,section.offsetHeight-section.firstElementChild.clientHeight));
}
const sequences = [...document.querySelectorAll('[data-sequence]')].map(s => new FrameSequence(s));

class ScrollVideo {
  constructor(video) {
    this.video = video; this.section = video.closest('.scrub'); this.overlay = this.section.querySelector('.overlay2');
    this.active = false; this.near = false; this.target = 0;
    new IntersectionObserver(([e]) => {
      this.near = e.isIntersecting;
      if (this.near && !video.hasAttribute('src') && !document.hidden) this.load();
      if (!this.near) this.unload();
      requestUpdate();
    }, {rootMargin:'50% 0px'}).observe(this.section);
    new IntersectionObserver(([e]) => { this.active = e.isIntersecting; requestUpdate(); }).observe(this.section);
    // Drain the latest scroll target even after scrolling has stopped.
    for (const event of ['loadedmetadata','loadeddata','seeked']) video.addEventListener(event, () => { this.seek(); requestUpdate(); });
    video.addEventListener('error', () => this.section.classList.add('media-fallback'));
  }
  load() { const poster=this.section.querySelector('.video-poster'); if(poster&&!poster.src)poster.src=poster.dataset.src; this.video.src = mobileQuery.matches && this.video.dataset.srcMobile || this.video.dataset.src; this.video.preload = 'auto'; this.video.load(); }
  unload() { this.video.pause(); if (this.video.hasAttribute('src')) { this.video.removeAttribute('src'); this.video.preload='none'; this.video.load(); } }
  seek() {
    const v = this.video;
    if (!this.active || document.hidden || v.seeking || v.readyState < 2 || !Number.isFinite(v.duration)) return;
    const target = reducedMotion.matches ? 0 : Math.min(this.target, Math.max(0,v.duration-1/30));
    if (Math.abs(v.currentTime-target)>1/60) v.currentTime=target;
  }
  update() {
    if (!this.near) return;
    if (!this.video.hasAttribute('src')) this.load();
    const p = progress(this.section), fade = reducedMotion.matches ? 1 : clamp((p-.08)/.18);
    if (this.overlay) { this.overlay.style.opacity=fade; this.overlay.style.transform=mobileQuery.matches ? `translateY(${(1-fade)*24}px)` : `translateY(calc(-50% + ${(1-fade)*30}px))`; }
    this.target = p*(Number.isFinite(this.video.duration) ? this.video.duration : 0); this.seek();
  }
}
const videos = [...document.querySelectorAll('.lazy-video')].map(v => new ScrollVideo(v));

const avatar = document.querySelector('#avatar'), model = document.querySelector('#model');
const floaters = [...avatar.querySelectorAll('.float-card')];
let avatarNear=false, avatarActive=false, avatarModule, avatarController, avatarGeneration=0;
function loadAvatar() {
  if (!avatarNear || document.hidden || avatarController || avatarModule) return;
  const generation = ++avatarGeneration;
  avatarModule = import('./avatar.js?v=7').then(async ({mountAvatar}) => {
    if (!avatarNear || document.hidden || generation !== avatarGeneration) return;
    avatarController = await mountAvatar(avatar, model, mobileQuery.matches);
    if (!avatarNear || document.hidden || generation !== avatarGeneration) { avatarController?.dispose(); avatarController=null; }
    requestUpdate();
  }).catch(() => avatar.classList.add('avatar-fallback')).finally(() => { avatarModule=null; });
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
function update(time) {
  raf=0; const dt=Math.min(32, previousTime ? time-previousTime : 1000/60); previousTime=time;
  let moving=false;
  for (const sequence of sequences) moving=sequence.update(dt)||moving;
  videos.forEach(v=>v.update()); updateAvatar();
  if (moving) requestUpdate(); else previousTime=0;
}
addEventListener('scroll',requestUpdate,{passive:true});
addEventListener('resize',requestUpdate,{passive:true});
mobileQuery.addEventListener('change', () => { sequences.forEach(s=>s.resize()); avatarGeneration++; avatarController?.dispose(); avatarController=null; loadAvatar(); requestUpdate(); });
reducedMotion.addEventListener('change',requestUpdate);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(raf); raf=0; previousTime=0;
    sequences.forEach(s=>{pool.reconcile(s,[]);s.release();}); videos.forEach(v=>v.unload());
    avatarGeneration++; avatarController?.dispose(); avatarController=null;
  } else { loadAvatar(); requestUpdate(); }
});
const revealObserver = new IntersectionObserver(entries => entries.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('seen'); revealObserver.unobserve(e.target); }
}), {rootMargin:'0px 0px -8% 0px',threshold:.08});
document.querySelectorAll('.reveal').forEach(e=>revealObserver.observe(e));
requestUpdate();

// Explicitly opt-in, used by tests/performance.html; no telemetry is sent.
if (new URLSearchParams(location.search).has('audit')) window.flipmediaDiagnostics=()=>({
  running:pool.running, queued:pool.jobs.size,
  sequences:sequences.map(s=>({frame:s.last,target:Math.round(s.target),active:s.active,near:s.near,decoded:s.cache.size,bytes:[...s.cache.values()].reduce((n,i)=>n+i.width*i.height*4,0)})),
  avatar:avatar.className,
  videos:videos.map(v=>({loaded:v.video.hasAttribute('src'),time:v.video.currentTime,target:v.target,seeking:v.video.seeking}))
});
