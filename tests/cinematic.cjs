const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('assets/js/cinematic.js','utf8').replace('export class','class');
function setup(reduce=false){
 const observers=[],documentListeners={},motionListeners={},listeners={},attrs=new Map(),classes=new Set();let playError=null,seekCount=0;
 const video={paused:true,muted:false,defaultMuted:false,playsInline:false,preload:'none',duration:3.6,_time:0,dataset:{src:'desktop.mp4',srcMobile:'mobile.mp4'},
  get currentTime(){return this._time;},set currentTime(t){seekCount++;this._time=t;},
  addEventListener(n,f){listeners[n]=f;},set src(s){attrs.set('src',s);},getAttribute:n=>attrs.get(n),hasAttribute:n=>attrs.has(n),removeAttribute:n=>attrs.delete(n),load(){},pause(){this.paused=true;},
  play(){if(playError)return Promise.reject(playError);this.paused=false;listeners.playing?.();return Promise.resolve();}};
 const image={src:'start.webp',getAttribute:()=> 'start.webp',decode:()=>Promise.resolve()},source={srcset:'start-mobile.webp',getAttribute:()=> 'start-mobile.webp'},button={hidden:true,addEventListener(n,f){this.click=f;},setAttribute(){}};
 const section={dataset:{chapter:'1',endPoster:'end.webp',endPosterMobile:'end-mobile.webp'},firstElementChild:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)},querySelector:s=>s==='video'?video:s==='picture'?{querySelector:s=>s==='img'?image:source}:s==='.cinematic-toggle'?button:{textContent:''}};
 const reducedMotion={matches:reduce,addEventListener:(n,f)=>motionListeners[n]=f},document={hidden:false,addEventListener:(n,f)=>documentListeners[n]=f};
 const context=vm.createContext({document,Promise,IntersectionObserver:class{constructor(f){observers.push(f)}observe(){}},section,options:{mobileQuery:{matches:true},reducedMotion}});
 vm.runInContext(code+';var c=new CinematicChapter(section,options);',context);
 return {c:context.c,video,section,button,source,image,observers,listeners,reducedMotion,motionListeners,document,documentListeners,get seekCount(){return seekCount;},setError:e=>playError=e};
}
const flush=()=>new Promise(r=>setImmediate(r));
(async()=>{
 let s=setup();assert.equal(s.video.hasAttribute('src'),false,'no eager URL before visibility');
 s.observers[0]([{isIntersecting:true}]);s.observers[1]([{isIntersecting:true,intersectionRatio:1}]);await flush();
 assert.equal(s.video.getAttribute('src'),'mobile.mp4');assert.equal(s.video.paused,false,'native playback starts');
 for(let i=0;i<100;i++)s.c.sync();assert.equal(s.seekCount,0,'visibility/scroll activity must not seek');
 s.video._time=1;s.button.click();assert.equal(s.video.paused,true);assert.equal(s.c.state,'paused');s.c.sync();assert.equal(s.video.paused,true,'user pause respected');
 s.button.click();await flush();assert.equal(s.video.paused,false,'explicit resume');
 s.observers[1]([{isIntersecting:false,intersectionRatio:0}]);assert.equal(s.video.paused,true,'offscreen pause');
 s.observers[0]([{isIntersecting:false}]);assert.equal(s.video.hasAttribute('src'),false,'decoder resources released');
 s.observers[1]([{isIntersecting:true,intersectionRatio:1}]);s.listeners.loadedmetadata();await flush();assert.equal(s.seekCount,1,'single restoration seek');assert.equal(s.video.currentTime,1);
 s.listeners.ended();await flush();assert.equal(s.c.completed,true);assert.equal(s.c.state,'ended');assert.equal(s.video.hasAttribute('src'),false);assert.equal(s.image.src,'end.webp');
 s.observers[1]([{isIntersecting:true,intersectionRatio:1}]);assert.equal(s.video.hasAttribute('src'),false,'completed chapter does not restart on scroll');
 s.reducedMotion.matches=true;s.motionListeners.change();assert.equal(s.c.state,'reduced');
 s.reducedMotion.matches=false;s.motionListeners.change();assert.equal(s.c.state,'ended');assert.equal(s.button.hidden,false,'replay restored after reduced motion');
 s.button.click();await flush();assert.equal(s.c.completed,false);assert.equal(s.video.paused,false,'explicit replay');
 s.document.hidden=true;s.documentListeners.visibilitychange();assert.equal(s.video.hasAttribute('src'),false,'background release');
 s=setup(true);s.observers[0]([{isIntersecting:true}]);s.observers[1]([{isIntersecting:true,intersectionRatio:1}]);assert.equal(s.video.hasAttribute('src'),false,'reduced motion downloads no video');assert.equal(s.button.hidden,true);
 s=setup();s.setError(Object.assign(new Error('blocked'),{name:'NotAllowedError'}));s.observers[1]([{isIntersecting:true,intersectionRatio:1}]);await flush();assert.equal(s.c.state,'blocked');assert.equal(s.button.hidden,false);s.setError(null);s.button.click();await flush();assert.equal(s.c.state,'playing','gesture retry succeeds');
 s.listeners.error();assert.equal(s.c.state,'error');assert.equal(s.video.hasAttribute('src'),false);
 console.log('PASS: native play, zero scroll seeks, pause/resume, release/restore, completion/replay, reduced motion, autoplay rejection and error fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
