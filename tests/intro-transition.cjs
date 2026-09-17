const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('assets/js/intro-transition.js','utf8').replaceAll('export ','');
let requests=0,closes=0;
const canvas={width:540,height:720,dataset:{},getContext:()=>({drawImage(){}})};
const section={querySelector:()=>canvas,getBoundingClientRect:()=>({top:-env.scrollY})};
const next={getBoundingClientRect:()=>({top:1232-env.scrollY})};
const media=()=>({matches:false,addEventListener(){}});
const mobile=media();mobile.matches=true;const reduced=media();
const env={console,Map,Set,Math,Number,String,Promise,AbortController,scrollY:0,innerHeight:844,performance:{now:()=>0},document:{hidden:false,addEventListener(){}},addEventListener(){},ResizeObserver:class{observe(){}},fetch:async()=>{requests++;return{ok:true,blob:async()=>({})}},createImageBitmap:async()=>({width:540,height:720,close(){closes++;}})};
vm.createContext(env);vm.runInContext(code+';this.IntroTransition=IntroTransition;this.introFrame=introFrame;',env);
const intro=new env.IntroTransition(section,next,{mobileQuery:mobile,reducedMotion:reduced,requestUpdate(){}});
const tick=()=>new Promise(r=>setImmediate(r));let time=100;
async function at(y){env.scrollY=y;for(let n=0;n<80;n++){intro.update(time+=16.67);await tick();}return intro.snapshot();}
(async()=>{
 assert.equal(env.introFrame(0,0,388,1232),1);
 assert.equal(env.introFrame(388,0,388,1232),61);
 assert.equal(env.introFrame(810,0,388,1232),46);
 assert.equal(env.introFrame(1232,0,388,1232),31);
 let s=await at(0);assert.equal(s.frame,1);
 s=await at(388);assert.equal(s.frame,61,'endpoint at first appearance of content');
 const a=await at(600),b=await at(950),c=await at(650),d=await at(1000);
 assert(a.frame>b.frame&&c.frame>b.frame&&d.frame<c.frame,'down/up/down reverses frames');
 assert(d.decoded<=12);assert(d.running<=2);
 const near=await at(1228),hidden=await at(1300),far=await at(3000);
 assert.equal(hidden.frame,near.frame);assert.equal(far.frame,near.frame);assert.equal(far.draws,hidden.draws);assert.equal(far.decoded,1);
 env.scrollY=1228;intro.update(time+=16.67);assert.equal(intro.drawn,near.frame,'first return paint preserves exact frame');
 s=await at(1100);assert(s.frame>near.frame,'up continues forward from retained frame');
 s=await at(388);assert.equal(s.frame,61);s=await at(0);assert.equal(s.frame,1,'scrolling to start traverses back, not a restart');
 // No autonomous playback, decode churn or repaint loop while settled.
 const idle=await at(900),count=requests;await at(900);assert.equal(requests,count);assert.equal(intro.draws,idle.draws);
 reduced.matches=true;intro.suspend();const saved=intro.drawn;await at(300);assert.equal(intro.drawn,saved);assert.equal(requests,count);
 const paused=intro.snapshot();env.document.hidden=true;await at(200);assert.equal(intro.draws,paused.draws);
 assert(closes>0);assert.equal(intro.errors.length,0);
 // A failed frame is not retried in a tight idle loop.
 env.document.hidden=false;reduced.matches=false;intro.failed.clear();intro.cache.clear();env.fetch=async()=>({ok:false,status:404});
 await at(250);const errors=intro.errors.length;await at(250);assert.equal(intro.errors.length,errors);assert(errors>0);
 console.log('PASS: geometry, both directions, rapid reversal, retained frame, no hidden/idle rendering, bounded decode/cache, reduced motion, error backoff');
})().catch(e=>{console.error(e);process.exitCode=1});
