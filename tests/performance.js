const report=document.querySelector('#report'),stage=document.querySelector('#stage');
let frame, longTasks=[], errors=[], running=false;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function load(width,height){
  if(running)return;
  stage.replaceChildren();frame=document.createElement('iframe');frame.title='FLIPMEDIA website';frame.width=width;frame.height=height;
  frame.src='../?audit=1&v=8';longTasks=[];errors=[];
  frame.onload=()=>{
    const w=frame.contentWindow;
    w.addEventListener('error',e=>errors.push(e.message));
    w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
    try {new w.PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});}catch{}
    report.textContent='Website geladen. Start de scrolltest of inspecteer een sectie.';
  };
  stage.append(frame);
}
function snapshot(){
  const w=frame.contentWindow;
  return {viewport:[w.innerWidth,w.innerHeight],diagnostics:w.flipmediaDiagnostics?.(),navigation:w.performance.getEntriesByType('navigation').map(e=>({ttfb:e.responseStart-e.requestStart,bytes:e.transferSize,encoded:e.encodedBodySize})),resources:w.performance.getEntriesByType('resource').map(e=>({name:e.name.split('/').pop(),url:e.name,bytes:e.transferSize,encoded:e.encodedBodySize,duration:Math.round(e.duration)})),longTasks,errors};
}
async function scrollTo(y,duration=1400){
  const w=frame.contentWindow,start=w.scrollY,time=performance.now();
  await new Promise(resolve=>{function step(now){const p=Math.min(1,(now-time)/duration);w.scrollTo({top:start+(y-start)*p,behavior:'instant'});if(p<1)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});
}
async function settle(){
  const w=frame.contentWindow, until=performance.now()+5000;
  while(performance.now()<until){const s=w.flipmediaDiagnostics?.().sequences[0];if(s&&s.frame===s.target)return;await wait(100);}
}
async function run(){
  if(!frame||running)return;running=true;report.textContent='Scrolltest loopt…';
  const results={};
  try{
    const w=frame.contentWindow,d=w.document;
    await scrollTo(0,1);await wait(1800);results.initial=snapshot();
    const top=d.querySelector('#top'),travel=top.offsetHeight-top.firstElementChild.clientHeight;
    const seen=new Set(), gaps=[];let last=performance.now(), sampling=true;
    function sample(t){gaps.push(t-last);last=t;seen.add(d.querySelector('canvas').dataset.frame);if(sampling)requestAnimationFrame(sample);}requestAnimationFrame(sample);
    await scrollTo(travel,4000);await settle();results.end=snapshot();
    await scrollTo(0,3500);await settle();sampling=false;results.reverse=snapshot();
    results.scroll={uniqueFrames:seen.size,p95FrameIntervalMs:Math.round(gaps.sort((a,b)=>a-b)[Math.floor(gaps.length*.95)]),maxFrameIntervalMs:Math.round(Math.max(...gaps))};
    await scrollTo(d.querySelector('#avatar').offsetTop+100,1);await wait(4500);results.avatar=snapshot();
    await scrollTo(d.querySelector('#scale').offsetTop+500,1);await wait(2500);results.video=snapshot();
    await scrollTo(d.querySelector('#start').offsetTop,1);await wait(500);results.released=snapshot();
    results.checks={
      noEarlyHeavyMedia:!results.initial.resources.some(r=>/\.mp4|\.glb|avatar\.js|model-viewer/.test(r.name)),
      lastFrame:results.end.diagnostics.sequences[0].frame===61,
      firstFrameOnReturn:results.reverse.diagnostics.sequences[0].frame===1,
      memoryBounded:[results.initial,results.end,results.reverse].every(r=>r.diagnostics.sequences[0].bytes<=(w.innerWidth<=800?32:64)*1024*1024),
      resourcesReleased:results.released.diagnostics.sequences.every(s=>s.decoded===0)&&results.released.diagnostics.videos.every(v=>!v.loaded),
      finalSeek:Math.abs(results.video.diagnostics.videos[0].time-Math.min(results.video.diagnostics.videos[0].target,2))<0.04,
      noScriptErrors:errors.length===0
    };
    if(results.scroll.p95FrameIntervalMs>200)results.scroll.note='Browser animation ticks are throttled; these intervals cannot establish physical-device frame rate.';
    report.textContent=JSON.stringify(results,null,2);
  }catch(e){report.textContent=String(e);}finally{running=false;}
}
document.querySelector('#mobile').onclick=()=>load(390,844);
document.querySelector('#desktop').onclick=()=>load(1280,800);
document.querySelector('#run').onclick=run;
document.querySelector('#idle').onclick=async()=>{
  if(!frame||running)return;running=true;report.textContent='Buffer-rusttest loopt…';
  try{
    const w=frame.contentWindow,d=w.document,top=d.querySelector('#top');
    const travel=top.offsetHeight-top.firstElementChild.clientHeight;
    await scrollTo(0,1);await wait(1800);
    await scrollTo(travel*29/60,4000);await settle();await wait(3000);
    const before=snapshot();await wait(4000);const after=snapshot();
    const frameRequests=r=>r.resources.filter(e=>/frame-\d+\.webp/.test(e.name)).length;
    const extra=frameRequests(after)-frameRequests(before);
    report.textContent=JSON.stringify({test:'stationary-frame-buffer',before,after,extraFrameRequests:extra,checks:{frame30:after.diagnostics.sequences[0].frame===30,noIdleFrameRequests:extra===0,idlePool:after.diagnostics.running===0&&after.diagnostics.queued===0}},null,2);
  }catch(e){report.textContent=String(e);}finally{running=false;}
};
document.querySelector('#read').onclick=()=>{if(frame)report.textContent=JSON.stringify(snapshot(),null,2);};
for(const id of ['avatar','video'])document.querySelector('#'+id).onclick=()=>{if(frame&&!running){const w=frame.contentWindow;w.scrollTo({top:w.document.querySelector(id==='video'?'#scale':'#avatar').offsetTop+100,behavior:'instant'});}};
