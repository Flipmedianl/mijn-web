const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// The turn is tied to the actual leading edge of #system (including its
// negative mobile margin), not the end of the sticky section.
export function introFrame(y, start, turn, end) {
  if (y <= turn) return 1 + 60 * clamp((y-start)/Math.max(1,turn-start),0,1);
  return 61 - 30 * clamp((y-turn)/Math.max(1,end-turn),0,1);
}

export class IntroTransition {
  constructor(section, next, {mobileQuery, reducedMotion, requestUpdate}) {
    this.section=section; this.next=next; this.canvas=section.querySelector('canvas');
    this.ctx=this.canvas.getContext('2d',{alpha:false,desynchronized:true});
    this.mobileQuery=mobileQuery; this.reducedMotion=reducedMotion; this.requestUpdate=requestUpdate;
    this.mobile=mobileQuery.matches; this.cache=new Map(); this.jobs=new Map(); this.failed=new Set();
    this.wanted=[]; this.running=0; this.generation=0; this.frame=1; this.target=1; this.direction=1;
    this.drawn=0; this.draws=0; this.active=false; this.dirty=true; this.redraw=true; this.lastTime=0;
    this.resumeFrame=null; this.resumeY=null; this.state='initial'; this.errors=[];
    new ResizeObserver(()=>{this.dirty=true;requestUpdate();}).observe(section);
    new ResizeObserver(()=>{this.dirty=true;requestUpdate();}).observe(next);
    addEventListener('resize',()=>{this.dirty=true;requestUpdate();},{passive:true});
    mobileQuery.addEventListener('change',()=>{
      this.stopLoads();this.release(0);this.mobile=mobileQuery.matches;this.redraw=true;this.failed.clear();requestUpdate();
    });
    reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)this.suspend();requestUpdate();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.suspend();else requestUpdate();});
  }
  measure() {
    const y=scrollY;
    this.start=this.section.getBoundingClientRect().top+y;
    this.end=this.next.getBoundingClientRect().top+y;
    this.turn=Math.max(this.start+1,this.end-innerHeight);
    this.dirty=false;
  }
  path(frame) {return `${this.mobile?'frames-mobile':'frames'}/frame-${String(frame).padStart(3,'0')}.webp`;}
  stopLoads() {
    this.generation++;this.wanted=[];
    for(const job of this.jobs.values())job.controller.abort();
    // Started jobs retain their slots until their decode/fetch actually settles.
    this.jobs.clear();
  }
  release(keep=this.drawn) {
    for(const [frame,image] of this.cache)if(frame!==keep){image.close?.();this.cache.delete(frame);}
  }
  suspend() {
    this.stopLoads();this.release();this.lastTime=0;
    // Keep the canvas backing store and its precise displayed frame. No poster reset.
  }
  plan(frame) {
    const limit=this.mobile?12:8;
    const frames=[frame,Math.round(this.target),this.drawn||1,61,31];
    for(let n=1;n<=6;n++)frames.push(frame+n*this.direction,frame-n*this.direction);
    this.wanted=[...new Set(frames)].filter(f=>f>=1&&f<=61).slice(0,limit);
    for(const [key,image] of this.cache)if(!this.wanted.includes(key)){image.close?.();this.cache.delete(key);}
    this.pump();
  }
  pump() {
    if(!this.active||document.hidden||this.reducedMotion.matches||!this.ctx)return;
    while(this.running<2) {
      const frame=this.wanted.find(f=>!this.cache.has(f)&&!this.jobs.has(f)&&!this.failed.has(f));
      if(frame===undefined)break;
      const job={frame,generation:this.generation,controller:new AbortController()};
      this.jobs.set(frame,job);this.running++;
      this.load(job).finally(()=>{
        if(this.jobs.get(frame)===job)this.jobs.delete(frame);
        this.running--;this.pump();
        if(this.active&&!document.hidden&&!this.reducedMotion.matches)this.requestUpdate();
      });
    }
  }
  async load(job) {
    let image;
    try {
      const response=await fetch(this.path(job.frame),{signal:job.controller.signal,cache:'force-cache'});
      if(!response.ok)throw new Error(`Intro frame ${job.frame}: HTTP ${response.status}`);
      const blob=await response.blob();
      if(job.controller.signal.aborted)return;
      if(typeof createImageBitmap==='function')image=await createImageBitmap(blob);
      else {
        const url=URL.createObjectURL(blob);
        try{image=new Image();image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}
      }
      if(job.generation!==this.generation||!this.wanted.includes(job.frame)){image.close?.();return;}
      this.cache.set(job.frame,image);
    } catch(error) {
      image?.close?.();
      if(error.name!=='AbortError'&&job.generation===this.generation){this.failed.add(job.frame);this.errors.push(String(error));}
    }
  }
  draw(frame) {
    const image=this.cache.get(frame);
    if(!image||!this.ctx)return false;
    if(this.drawn===frame&&!this.redraw)return true;
    // Native source dimensions, no viewport/DPR resize churn on mobile Safari.
    if(this.canvas.width!==image.width||this.canvas.height!==image.height){this.canvas.width=image.width;this.canvas.height=image.height;}
    this.ctx.drawImage(image,0,0);this.drawn=frame;this.draws++;this.redraw=false;
    this.canvas.dataset.frame=String(frame);return true;
  }
  update(time=performance.now()) {
    if(this.dirty)this.measure();
    const y=scrollY;
    if(document.hidden||this.reducedMotion.matches||!this.ctx){this.state=this.reducedMotion.matches?'reduced':'suspended';return false;}
    const visible=y<this.end && y+innerHeight>this.start;
    if(!visible) {
      if(this.active){
        this.frame=this.drawn||this.frame;this.resumeFrame=this.frame;this.resumeY=this.end;
        this.active=false;this.suspend();
      }
      this.state='offscreen';return false;
    }
    const returning=!this.active&&this.resumeFrame!==null;
    this.active=true;
    const ideal=introFrame(y,this.start,this.turn,this.end);
    // Anchor a return at the last rendered position, including a fast fling that
    // left before the renderer caught up. Blend back to the common turn frame.
    let target=ideal;
    if(this.resumeFrame!==null && y>this.turn) {
      target=this.resumeFrame+(61-this.resumeFrame)*clamp((this.end-y)/(this.end-this.turn),0,1);
    } else if(y<=this.turn)this.resumeFrame=null;
    if(target!==this.target)this.direction=target>this.target?1:-1;
    this.target=target;this.state=y>=this.turn?'overlap':'forward';
    if(returning){this.lastTime=time;this.plan(Math.round(this.frame));return true;}
    const dt=this.lastTime?clamp(time-this.lastTime,0,34):16.67;this.lastTime=time;
    const delta=this.target-this.frame;
    const next=this.frame+Math.sign(delta)*Math.min(Math.abs(delta),dt*.18);
    this.plan(Math.round(next));
    // Do not advance the rendered timeline while a needed image is decoding.
    // Coalescing always prioritizes the latest direction/target, not a FIFO backlog.
    if(this.draw(Math.round(next)))this.frame=next;
    else if(this.draw(Math.round(this.target)))this.frame=this.target;
    else if(!this.drawn)this.draw(1);
    const moving=Math.abs(this.target-this.frame)>.01;
    // Sleep while waiting for a decode; its completion wakes the shared RAF.
    return moving&&this.cache.has(Math.round(next));
  }
  snapshot() {
    return {state:this.state,frame:this.drawn,current:this.frame,target:this.target,active:this.active,
      retained:this.resumeFrame,turn:this.turn,end:this.end,decoded:this.cache.size,running:this.running,
      bytes:[...this.cache.values()].reduce((n,i)=>n+i.width*i.height*4,0),draws:this.draws,errors:[...this.errors]};
  }
}
