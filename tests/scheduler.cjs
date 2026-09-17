const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync('assets/js/site.js','utf8').split('const sequences =')[0];
let pending=[],maxRunning=0,running=0,closed=0;
const context=vm.createContext({
  matchMedia:q=>({matches:q.includes('max-width')}), navigator:{}, document:{hidden:false},
  update(){}, performance, AbortController, setTimeout, console, devicePixelRatio:2,
  requestAnimationFrame:()=>1, ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}},
  window:{createImageBitmap:true},
  createImageBitmap:async()=>({width:540,height:720,close(){closed++;}}),
  fetch:(_url,{signal})=>new Promise((resolve,reject)=>{
    running++;maxRunning=Math.max(maxRunning,running);
    let done=false;
    const finish=()=>{if(done)return;done=true;running--;resolve({ok:true,blob:async()=>({})});};
    signal.addEventListener('abort',()=>{if(done)return;done=true;running--;reject(Object.assign(new Error(),{name:'AbortError'}));});
    pending.push(finish);
  })
});
vm.runInContext(source,context);
const canvas={dataset:{},width:0,height:0,clientWidth:390,clientHeight:844,getContext:()=>({drawImage(){}})};
const section={dataset:{frameFrom:'1',frameTo:'10000'},offsetHeight:3000,firstElementChild:{clientHeight:844},querySelector:s=>s==='canvas'?canvas:null,getBoundingClientRect:()=>({top:-1000})};
context.section=section;
vm.runInContext('const s = new FrameSequence(section); s.near=true; s.active=true; s.resize(); s.update(16.67);',context);
const flush=async()=>{for(let i=0;i<30;i++){const batch=pending;pending=[];batch.forEach(f=>f());await new Promise(r=>setImmediate(r));}};
(async()=>{
 await flush();assert.ok(maxRunning<=3,'global mobile concurrency capped');
 assert.ok(vm.runInContext('s.cache.size',context)<=18,'10,000 frames do not preload in full');
 const current=vm.runInContext('s.current',context);assert.ok(current>1&&current<3,'original frame progression restored');
 vm.runInContext('s.current=5000; s.update(16.67); pool.reconcile(s,[]);',context);
 await flush();assert.equal(running,0,'stale requests canceled');
 vm.runInContext('for(let i=1;i<80;i++)s.cache.set(i,{width:540,height:720,close(){}});s.trim();',context);
 assert.ok(vm.runInContext('s.cache.size*540*720*4',context)<=32*1024*1024,'decoded memory bounded');
 vm.runInContext('s.release()',context);assert.equal(vm.runInContext('s.cache.size',context),0,'offscreen release');
 console.log('PASS: bounded concurrency, large sequences, smooth stepping, stale cancellation, memory budget, release');
})().catch(e=>{console.error(e);process.exitCode=1;});
