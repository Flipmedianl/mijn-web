const report=document.querySelector('#report'),stage=document.querySelector('#stage');
let frame,running=false,errors=[],networkErrors=[];
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,timeout=20000){const end=performance.now()+timeout;while(performance.now()<end){if(check())return;await wait(100);}throw new Error('Timeout waiting for intro frame');}
function snapshot(){const w=frame.contentWindow,d=w.document;return {y:w.scrollY,viewport:[w.innerWidth,w.innerHeight],intro:w.flipmediaDiagnostics?.().intro,systemTop:d.querySelector('#system').getBoundingClientRect().top,controls:d.querySelectorAll('#top button,#top video').length,resources:w.performance.getEntriesByType('resource').map(r=>({url:r.name,bytes:r.encodedBodySize,status:r.responseStatus})),errors:[...errors],networkErrors:[...networkErrors]};}
async function at(y){
 const w=frame.contentWindow;w.scrollTo({top:y,behavior:'instant'});
 await until(()=>{
  const s=w.flipmediaDiagnostics?.().intro;if(!s)return false;
  const actual=w.scrollY;
  if(actual>=s.end)return s.state==='offscreen'&&s.running===0;
  const expected=actual<=s.turn?1+60*Math.max(0,Math.min(1,actual/s.turn)):(s.retained??31)+(61-(s.retained??31))*(s.end-actual)/(s.end-s.turn);
  return s.active&&Math.abs(s.target-expected)<.01&&Math.abs(s.current-s.target)<.01&&Math.abs(s.frame-s.target)<=.5&&s.running===0;
 });return snapshot();
}
function load(width,height){
 if(running)return;running=true;errors=[];networkErrors=[];stage.replaceChildren();
 frame=document.createElement('iframe');frame.title='FLIPMEDIA overgang';frame.width=width;frame.height=height;
 frame.src='../?audit=1&transitionTest='+Date.now();
 frame.onload=()=>{const w=frame.contentWindow;w.addEventListener('error',e=>{if(e.message)errors.push(e.message);else networkErrors.push(e.target?.src||'resource');},true);w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));run();};stage.append(frame);report.textContent='Overgang testen…';
}
async function run(){
 const result={};try{
  const w=frame.contentWindow;
  await until(()=>w.flipmediaDiagnostics?.().intro.frame===1);
  result.initial=snapshot();const {turn,end}=result.initial.intro,span=end-turn;
  result.forward=await at(turn*.5);result.turn=await at(turn);
  result.down1=await at(turn+span*.25);result.down2=await at(turn+span*.65);
  result.up1=await at(turn+span*.4);result.down3=await at(turn+span*.75);
  result.edge=await at(end-2);result.hidden=await at(end+60);await wait(1200);result.hiddenIdle=snapshot();
  result.returned=await at(end-2);result.up2=await at(turn+span*.5);
  // Direction changes before the renderer has settled: only the latest target wins.
  for(const p of [.7,.3,.8,.4]){w.scrollTo({top:turn+span*p,behavior:'instant'});await wait(45);}
  result.rapid=await at(turn+span*.4);
  result.idle=snapshot();await wait(1200);result.idleLater=snapshot();
  const s=x=>result[x].intro;
  result.checks={noIntroPlayer:result.initial.controls===0,
   forward:s('forward').frame>1&&s('forward').frame<61,
   turnAtContentEdge:s('turn').frame===61&&Math.abs(result.turn.systemTop-w.innerHeight)<2,
   downReverses:s('down2').frame<s('down1').frame,
   upReverses:s('up1').frame>s('down2').frame,
   downAgain:s('down3').frame<s('up1').frame,
   hiddenRetains:s('hidden').frame===s('edge').frame&&s('hiddenIdle').frame===s('edge').frame,
   hiddenStops:s('hiddenIdle').draws===s('hidden').draws&&s('hiddenIdle').decoded<=1&&s('hiddenIdle').running===0,
   returnNoReset:s('returned').frame===s('edge').frame&&s('up2').frame>s('returned').frame,
   rapidReversal:Math.abs(s('rapid').frame-s('rapid').target)<=1,
   idleSleeps:s('idle').draws===s('idleLater').draws,
   boundedBuffer:Object.values(result).filter(v=>v?.intro).every(v=>v.intro.decoded<=(w.innerWidth<=800?12:8)&&v.intro.running<=2),
   noErrors:errors.length===0&&networkErrors.length===0&&s('idleLater').errors.length===0,
   noBadResponses:!result.idleLater.resources.some(r=>r.status>=400),
   noIntroMovie:!result.idleLater.resources.some(r=>/chapter-1-.*mp4/.test(r.url)),
   shortIntro:w.document.querySelector('#top').offsetHeight<=w.innerHeight*1.6,
   avatarPreserved:w.document.querySelector('#model').dataset.srcMobile==='assets/avatar-desktop.glb?v=8'};
  report.textContent=JSON.stringify(result,null,2);
 }catch(error){report.textContent=JSON.stringify({error:String(error),partial:result,current:snapshot()},null,2);}finally{running=false;}
}
document.querySelector('#mobile').onclick=()=>load(390,844);
document.querySelector('#desktop').onclick=()=>load(1280,800);
for(const [id,p] of [['half',.5],['up',.3],['down',.7]])document.querySelector('#'+id).onclick=async()=>{if(!running&&frame){const s=frame.contentWindow.flipmediaDiagnostics().intro;report.textContent=JSON.stringify(await at(s.turn+(s.end-s.turn)*p),null,2);}};
document.querySelector('#read').onclick=()=>{if(!running&&frame)report.textContent=JSON.stringify(snapshot(),null,2);};
