// Visibility starts a chapter; native playback owns time. Scroll never seeks.
export class CinematicChapter {
  constructor(section, {mobileQuery, reducedMotion}) {
    this.section=section; this.video=section.querySelector('video');
    this.picture=section.querySelector('picture'); this.image=this.picture.querySelector('img');
    this.source=this.picture.querySelector('source'); this.button=section.querySelector('.cinematic-toggle');
    this.status=section.querySelector('.chapter-status');
    this.mobileQuery=mobileQuery; this.reducedMotion=reducedMotion;
    this.active=false; this.near=false; this.completed=false; this.userPaused=false;
    this.blocked=false; this.failed=false; this.pending=false; this.generation=0; this.resumeTime=0;
    this.savedPoster={src:this.image.getAttribute('src'),srcset:this.source.getAttribute('srcset')};
    this.stats={plays:0,seeks:0,unloads:0};
    this.video.muted=true; this.video.defaultMuted=true; this.video.playsInline=true;
    this.setState(reducedMotion.matches?'reduced':'ready');
    new IntersectionObserver(([e])=>{
      this.near=e.isIntersecting;
      if(this.near) this.ensureLoaded(); else this.unload();
    },{rootMargin:'250px 0px'}).observe(section);
    // Observe the sticky media viewport, not the much taller scroll section.
    new IntersectionObserver(([e])=>{
      this.active=e.isIntersecting && e.intersectionRatio>=.2;
      if(this.active) this.sync(); else this.pauseOffscreen();
    },{threshold:[0,.2]}).observe(section.firstElementChild);
    this.video.addEventListener('loadedmetadata',()=>{
      // One restoration seek after resource release, never a scroll seek.
      if(this.resumeTime>0 && Number.isFinite(this.video.duration)) {
        this.video.currentTime=Math.min(this.resumeTime,Math.max(0,this.video.duration-.05));
        this.stats.seeks++; this.resumeTime=0;
      }
    });
    this.video.addEventListener('playing',()=>{
      if(!this.active || document.hidden || this.reducedMotion.matches || this.userPaused) {
        this.video.pause(); return;
      }
      this.section.classList.add('cinematic-playing'); this.setState('playing');
    });
    this.video.addEventListener('ended',()=>{
      this.completed=true; this.resumeTime=0; this.showPoster(true,false); this.setState('ended');
      // Keep the decoded last video frame visible until its poster is ready.
      Promise.resolve(this.image.decode?.()).catch(()=>{}).finally(()=>{if(this.completed)this.unload();});
    });
    this.video.addEventListener('waiting',()=>{if(this.active&&!this.completed&&!this.reducedMotion.matches)this.setState('loading');});
    this.video.addEventListener('pause',()=>{
      if(this.active&&!document.hidden&&!this.completed&&!this.reducedMotion.matches&&this.video.hasAttribute('src')&&this.state==='playing')this.setState('paused');
    });
    this.video.addEventListener('error',()=>{
      if(!this.video.hasAttribute('src'))return;
      this.failed=true; this.showPoster(false); this.setState('error'); this.unload();
    });
    this.button.addEventListener('click',()=>this.toggle());
    reducedMotion.addEventListener('change',()=>{
      if(reducedMotion.matches){this.showPoster(this.completed);this.unload();this.setState('reduced');}
      else {this.blocked=false;this.setState(this.completed?'ended':this.userPaused?'paused':'ready');this.sync();}
    });
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)this.unload(); else this.sync();
    });
  }
  setState(state) {
    this.state=state; this.section.dataset.cinematicState=state;
    const chapter=this.section.dataset.chapter;
    const labels={ready:`Hoofdstuk ${chapter}`,playing:`Hoofdstuk ${chapter}`,loading:'Film laden…',paused:'Gepauzeerd',blocked:'Speel de film',error:'Film niet beschikbaar',reduced:`Hoofdstuk ${chapter} · stil beeld`,ended:chapter==='1'?'Vervolg na de AI Partner':'Het verhaal compleet'};
    this.status.textContent=labels[state] || labels.ready;
    this.button.hidden=state==='reduced'||state==='error';
    this.button.textContent=state==='playing'||state==='loading'?'Pauzeer':state==='ended'?'Opnieuw afspelen':'Afspelen';
    this.button.setAttribute('aria-label',`${this.button.textContent} — hoofdstuk ${chapter}`);
  }
  showPoster(end,reveal=true) {
    if(reveal)this.section.classList.remove('cinematic-playing');
    this.image.src=end?this.section.dataset.endPoster:this.savedPoster.src;
    this.source.srcset=end?this.section.dataset.endPosterMobile:this.savedPoster.srcset;
  }
  ensureLoaded() {
    if(document.hidden || this.reducedMotion.matches || this.completed || this.failed || this.video.hasAttribute('src'))return;
    this.video.preload=this.active?'auto':'metadata';
    this.video.src=this.mobileQuery.matches?this.video.dataset.srcMobile:this.video.dataset.src;
    this.video.load();
  }
  sync() {
    if(!this.active || document.hidden || this.reducedMotion.matches || this.completed || this.userPaused || this.blocked || this.failed)return;
    this.ensureLoaded(); this.play();
  }
  play() {
    if(this.pending || !this.video.paused || !this.video.hasAttribute('src'))return;
    this.pending=true; const generation=this.generation; this.stats.plays++;
    // This is also called directly by a click for Safari's user-gesture fallback.
    let promise;
    try {promise=this.video.play();} catch(error){this.onPlayError(error,generation);return;}
    Promise.resolve(promise).catch(error=>this.onPlayError(error,generation)).finally(()=>{
      if(generation===this.generation)this.pending=false;
    });
  }
  onPlayError(error,generation) {
    if(generation!==this.generation)return;
    this.pending=false;
    if(error.name==='AbortError')return;
    this.blocked=true; this.showPoster(false); this.setState('blocked');
  }
  pauseOffscreen() {
    this.generation++;this.pending=false;this.video.pause();
    if(!this.completed && !this.reducedMotion.matches && !this.blocked && !this.failed)this.setState(this.userPaused?'paused':'ready');
  }
  unload() {
    this.pauseOffscreen();
    if(!this.video.hasAttribute('src'))return;
    if(!this.completed)this.resumeTime=this.video.currentTime || this.resumeTime;
    this.video.removeAttribute('src');this.video.preload='none';this.video.load();this.stats.unloads++;
    this.showPoster(this.completed);
  }
  toggle() {
    if(this.reducedMotion.matches || this.failed)return;
    if(!this.video.paused && !this.completed){this.userPaused=true;this.video.pause();this.setState('paused');return;}
    if(this.completed){this.completed=false;this.resumeTime=0;this.showPoster(false);}
    this.userPaused=false;this.blocked=false;this.active=true;this.ensureLoaded();this.play();
  }
  snapshot() {
    return {chapter:this.section.dataset.chapter,state:this.state,active:this.active,loaded:this.video.hasAttribute('src'),time:this.video.currentTime,paused:this.video.paused,completed:this.completed,src:this.video.currentSrc || this.video.getAttribute('src'),...this.stats};
  }
}
