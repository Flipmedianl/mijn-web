const vm=require('node:vm'),assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync('assets/js/site.js','utf8').split('class ScrollVideo {')[1].split('const videos =')[0];
const listeners={},attributes=new Map();let seeks=[];
const video={dataset:{src:'desktop.mp4',srcMobile:'mobile.mp4'},readyState:2,duration:2,seeking:false,_time:0,
 closest(){return {querySelector(){return null;},classList:{add(){}}};},addEventListener(name,fn){listeners[name]=fn;},
 hasAttribute(name){return attributes.has(name);},removeAttribute(name){attributes.delete(name);},load(){},pause(){},
 set src(value){attributes.set('src',value);},get currentTime(){return this._time;},set currentTime(value){this._time=value;this.seeking=true;seeks.push(value);}};
const context=vm.createContext({video,mobileQuery:{matches:true},reducedMotion:{matches:false},document:{hidden:false},IntersectionObserver:class{observe(){}},requestUpdate(){}});
vm.runInContext('class ScrollVideo {'+source+'; const s=new ScrollVideo(video);s.active=true;s.load();s.target=.4;s.seek();',context);
assert.equal(attributes.get('src'),'mobile.mp4');assert.deepEqual(seeks,[.4]);
vm.runInContext('s.target=1.8;s.seek()',context);assert.deepEqual(seeks,[.4],'no overlapping seeks');
video.seeking=false;listeners.seeked();assert.deepEqual(seeks,[.4,1.8],'latest target drains after scroll stops');
video.seeking=false;vm.runInContext('s.active=false;s.target=.2;s.seek();s.unload()',context);
assert.deepEqual(seeks,[.4,1.8],'offscreen seeking stops');assert.equal(attributes.has('src'),false,'source detached');
console.log('PASS: mobile source, serialized seeking, final-target drain, offscreen stop, source release');
