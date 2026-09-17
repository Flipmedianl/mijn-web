// This module and model-viewer are requested only near the avatar section.
let viewerImport;
export async function mountAvatar(section, model, mobile, isCurrent = () => true) {
  let disposed=false, lastAngle=NaN;
  const fail=()=>{section.classList.remove('avatar-ready');section.classList.add('avatar-fallback');};
  const canvas=document.createElement('canvas');
  let gl;
  try { gl=canvas.getContext('webgl2')||canvas.getContext('webgl'); } catch {}
  if (!gl) { fail(); return {update(){},dispose(){}}; }
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  try {
    viewerImport ||= import('https://unpkg.com/@google/model-viewer@4.1.0/dist/model-viewer.min.js');
    await viewerImport;
  } catch { viewerImport=null; fail(); return {update(){},dispose(){}}; }
  if (!isCurrent()) return null;
  const Viewer=customElements.get('model-viewer');
  Viewer.modelCacheSize=0;
  Viewer.minimumRenderScale=0.5;
  const ready=()=>{if(!disposed){section.classList.add('avatar-ready');section.classList.remove('avatar-fallback');}};
  model.addEventListener('load',ready);
  model.addEventListener('error',fail);
  model.setAttribute('shadow-intensity',mobile?'0':'0.35');
  model.setAttribute('interpolation-decay',mobile?'80':'100');
  model.setAttribute('loading','eager');
  model.setAttribute('src',mobile?model.dataset.srcMobile:model.dataset.src);
  return {
    update(p) {
      // Small, quantized changes avoid rebuilding a camera target for every pixel.
      const angle=Math.round((-34+p*68)*(mobile?1:2))/(mobile?1:2);
      if (angle===lastAngle || disposed) return;
      lastAngle=angle; model.cameraOrbit=`${angle}deg 75deg auto`;
    },
    dispose() {
      disposed=true; model.removeEventListener('load',ready);model.removeEventListener('error',fail);
      model.removeAttribute('src'); section.classList.remove('avatar-ready');
    }
  };
}
