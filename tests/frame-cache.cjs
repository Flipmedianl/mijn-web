// Regression: stopping mid-sequence must not continuously re-decode wanted frames.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('assets/js/site.js','utf8').split('const sequences =')[0];
async function run(direction){
 let requests=0,closed=0;
 const c=vm.createContext({matchMedia:q=>({matches:q.includes('max-width')}),navigator:{},update(){},document:{hidden:false},performance,AbortController,devicePixelRatio:2,requestAnimationFrame:()=>1,ResizeObserver:class{observe(){}},IntersectionObserver:class{observe(){}},window:{createImageBitmap:true},createImageBitmap:async()=>({width:540,height:720,close(){closed++;}}),fetch:async()=>{requests++;return {ok:true,blob:async()=>({})}}});
 vm.runInContext(source,c);
 c.direction=direction;
 c.section={dataset:{frameFrom:'1',frameTo:'61'},offsetHeight:1444,firstElementChild:{clientHeight:844},getBoundingClientRect:()=>({top:-290}),querySelector:s=>s==='canvas'?{dataset:{},width:390,height:844,getContext:()=>({drawImage(){}})}:null};
 vm.runInContext('const s=new FrameSequence(section);s.near=s.active=true;s.current=s.target=s.last=30;s.direction=direction;for(let i=20;i<=40;i++)s.cache.set(i,{width:540,height:720,close(){}})',c);
 for(let i=0;i<40;i++){vm.runInContext('s.update(16.67)',c);await new Promise(r=>setImmediate(r));}
 assert.equal(requests,2,'only the two missing directional frames should load');
 assert.equal(closed,0,'newly decoded wanted images must survive trimming');
 assert.equal(vm.runInContext('s.current',c),30,'stationary scroll position');
 assert.ok(vm.runInContext('[...s.wanted].every(f=>s.cache.has(f))',c),'full desired buffer retained');
 assert.ok(vm.runInContext('s.cache.size*540*720*4',c)<=32*1024*1024,'same memory budget');
 assert.ok(vm.runInContext('s.cache.has(s.last)',c),'displayed frame retained');
 console.log(`PASS direction ${direction}: ${requests} loads across 40 stationary updates; no repeated decoding`);
}
(async()=>{await run(1);await run(-1);})().catch(e=>{console.error(e);process.exitCode=1;});
