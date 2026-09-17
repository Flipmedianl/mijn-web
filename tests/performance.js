const report=document.querySelector('#report'),stage=document.querySelector('#stage');
let frame,width=390,height=844,running=false,errors=[],longTasks=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function load(w,h,runAfter=false){
 if(running)return;width=w;height=h;stage.replaceChildren();errors=[];longTasks=[];
 frame=document.createElement('iframe');frame.title='FLIPMEDIA website';frame.width=w;frame.height=h;
 frame.src='../?audit=1&testRun='+Date.now();report.textContent='Website laden…';
 frame.onload=()=>{
  const win=frame.contentWindow;
  win.addEventListener('error',e=>errors.push(e.message));win.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  try{new win.PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});}catch{}
  report.textContent='Website geladen.';if(runAfter)run();
 };stage.append(frame);
}
function snapshot(){const w=frame.contentWindow;return {viewport:[w.innerWidth,w.innerHeight],diagnostics:w.flipmediaDiagnostics?.(),resources:w.performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.transferSize,encoded:r.encodedBodySize,initiator:r.initiatorType})),errors:[...errors],longTasks:[...longTasks]};}
async function until(check,ms=15000){const end=performance.now()+ms;while(performance.now()<end){if(check())return true;await wait(100);}return false;}
async function run(){
 if(running)return;running=true;report.textContent='Playbacktest loopt…';const result={};
 try{
  const w=frame.contentWindow,d=w.document,first=d.querySelector('#top video'),second=d.querySelector('#scale video');
  await until(()=>w.flipmediaDiagnostics?.().chapters[0].state==='playing'||w.flipmediaDiagnostics?.().chapters[0].state==='blocked');
  result.initial=snapshot();const firstTime=first.currentTime;await wait(900);result.stationary=snapshot();
  result.movesWithoutScroll=first.currentTime>firstTime+.1||w.flipmediaDiagnostics().chapters[0].completed;
  await until(()=>w.flipmediaDiagnostics().chapters[0].completed);result.end=snapshot();
  d.querySelector('#top .cinematic-toggle').click();await until(()=>!first.paused);await wait(150);
  d.querySelector('#top .cinematic-toggle').click();const pausedAt=first.currentTime;await wait(400);result.userPause=first.paused&&Math.abs(first.currentTime-pausedAt)<.05;
  d.querySelector('#top .cinematic-toggle').click();await until(()=>!first.paused);result.resume=!first.paused;
  w.scrollTo({top:d.querySelector('#avatar').offsetTop+100,behavior:'instant'});await wait(2000);result.avatar=snapshot();
  w.scrollTo({top:d.querySelector('#scale').offsetTop,behavior:'instant'});
  await until(()=>!second.paused);const secondTime=second.currentTime;await wait(800);result.secondMovesWithoutScroll=second.currentTime>secondTime+.1||w.flipmediaDiagnostics().chapters[1].completed;
  await until(()=>w.flipmediaDiagnostics().chapters[1].completed);result.second=snapshot();
  w.scrollTo({top:d.querySelector('#start').offsetTop,behavior:'instant'});await wait(1200);result.released=snapshot();
  result.checks={
   noFrameDecoderRequests:!result.released.resources.some(r=>r.initiator==='fetch'&&/frame-\d+/.test(r.name)),
   noEarlyChapter2:!result.initial.resources.some(r=>/chapter-2-.*mp4/.test(r.name)),
   independentPlayback:result.movesWithoutScroll&&result.secondMovesWithoutScroll,
   deliberateEnd:result.end.diagnostics.chapters[0].state==='ended'&&result.second.diagnostics.chapters[1].state==='ended',
   noScrollSeeks:result.released.diagnostics.chapters.every(c=>c.seeks===0),
   pauseResume:result.userPause&&result.resume,
   resourcesReleased:result.released.diagnostics.chapters.every(c=>!c.loaded),
   distinctChapters:first.dataset.srcMobile!==second.dataset.srcMobile,
   shortIntro:d.querySelector('#top').offsetHeight<=w.innerHeight*1.6,
   avatarPreserved:d.querySelector('#model').dataset.srcMobile==='assets/avatar-desktop.glb?v=8',
   noScriptErrors:errors.length===0
  };report.textContent=JSON.stringify(result,null,2);
 }catch(e){report.textContent=String(e);}finally{running=false;}
}
document.querySelector('#mobile').onclick=()=>load(390,844);
document.querySelector('#desktop').onclick=()=>load(1280,800);
document.querySelector('#run').onclick=()=>load(width,height,true);
document.querySelector('#read').onclick=()=>{if(frame&&!running)report.textContent=JSON.stringify(snapshot(),null,2);};
for(const [button,id] of [['avatar','avatar'],['chapter2','scale']])document.querySelector('#'+button).onclick=()=>{if(frame&&!running)frame.contentWindow.scrollTo({top:frame.contentWindow.document.getElementById(id).offsetTop,behavior:'instant'});};
