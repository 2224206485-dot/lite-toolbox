'use strict';
let pdfFreeCropRect=null,pdfFreeReferencePage=0,pdfCropDrag=null,pdfCropReady=false,pdfCropBaselineKey='';
let pdfCropPageSize={width:0,height:0};
const pdfCropOverlay=$('pdf-crop-overlay'),pdfCropImage=$('pdf-result-image');
function pdfFreeCropOptions(){
  const scope=$('pdf-crop-scope').value;
  if(scope==='pages'&&!$('pdf-pages').value.trim())throw Error('请填写需要应用裁剪的页码');
  return {rect:pdfFreeCropRect?[...pdfFreeCropRect]:null,pages:scope==='all'?'':scope==='pages'?$('pdf-pages').value:String(pdfFreeReferencePage+1)};
}
function resetPdfFreeCrop(){pdfFreeCropRect=null;pdfCropDrag=null;pdfCropBaselineKey='';drawPdfCrop();}
function pdfFreeCropLoading(){pdfCropReady=false;pdfCropOverlay.hidden=true;}
function pdfCropControls(){
  const active=pdfAction==='pdf-free-crop';$('pdf-free-crop-settings').hidden=!active;
  if(active)$('pdf-pages-group').hidden=$('pdf-crop-scope').value!=='pages';
}
function syncPdfFreeCrop(result){
  if(result)pdfCropPageSize={width:result.width,height:result.height};
  const key=sourceSignature()+'|'+JSON.stringify(pdfSteps)+'|'+previewPage;
  if(key!==pdfCropBaselineKey){pdfFreeCropRect=null;pdfCropBaselineKey=key;pdfFreeReferencePage=previewPage;}
  pdfCropReady=!pdfPreviewLoading&&pdfCropImage.complete&&pdfCropImage.naturalWidth>0;
  const stage=$('pdf-preview-stage');pdfCropImage.style.maxHeight=Math.max(150,stage.clientHeight-40)+'px';
  pdfCropControls();drawPdfCrop();
}
function drawPdfCrop(){
  const active=pdfAction==='pdf-free-crop'&&pdfDraftEnabled&&pdfFiles.length>0&&pdfCropReady&&!pdfCropImage.hidden;
  pdfCropOverlay.hidden=!active;$('pdf-crop-result').hidden=!active||!pdfFreeCropRect;
  if(!active)return;
  const W=pdfCropImage.naturalWidth,H=pdfCropImage.naturalHeight;
  pdfCropOverlay.width=W;pdfCropOverlay.height=H;const ctx=pdfCropOverlay.getContext('2d');
  ctx.clearRect(0,0,W,H);
  if(!pdfFreeCropRect){$('pdf-crop-size').textContent='请在页面上拖出需要保留的区域';return;}
  const [nx,ny,nw,nh]=pdfFreeCropRect,x=nx*W,y=ny*H,w=nw*W,h=nh*H;
  const unit=W/Math.max(1,pdfCropOverlay.getBoundingClientRect().width),handle=9*unit;
  ctx.fillStyle='rgba(13,30,23,.48)';ctx.fillRect(0,0,W,y);ctx.fillRect(0,y+h,W,H-y-h);ctx.fillRect(0,y,x,h);ctx.fillRect(x+w,y,W-x-w,h);
  ctx.strokeStyle='white';ctx.lineWidth=1.5*unit;ctx.strokeRect(x,y,w,h);ctx.lineWidth=.5*unit;
  for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(x+w*i/3,y);ctx.lineTo(x+w*i/3,y+h);ctx.stroke();ctx.beginPath();ctx.moveTo(x,y+h*i/3);ctx.lineTo(x+w,y+h*i/3);ctx.stroke();}
  ctx.fillStyle='white';for(const [cx,cy]of[[x,y],[x+w/2,y],[x+w,y],[x,y+h/2],[x+w,y+h/2],[x,y+h],[x+w/2,y+h],[x+w,y+h]])ctx.fillRect(cx-handle/2,cy-handle/2,handle,handle);
  const mm=72/25.4;$('pdf-crop-size').textContent=`保留约 ${(nw*pdfCropPageSize.width/mm).toFixed(1)} × ${(nh*pdfCropPageSize.height/mm).toFixed(1)} mm`;
  const out=$('pdf-crop-result-canvas'),scale=Math.min(320/w,200/h,1);out.width=Math.max(1,Math.round(w*scale));out.height=Math.max(1,Math.round(h*scale));out.getContext('2d').drawImage(pdfCropImage,x,y,w,h,0,0,out.width,out.height);
}
function pdfCropPoint(e){const r=pdfCropOverlay.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
function pdfCropHit(p){
  if(!pdfFreeCropRect)return'new';const [x,y,w,h]=pdfFreeCropRect,r=pdfCropOverlay.getBoundingClientRect(),tx=12/r.width,ty=12/r.height;
  let k='';if(p.x>=x-tx&&p.x<=x+w+tx){if(Math.abs(p.y-y)<ty)k+='n';else if(Math.abs(p.y-y-h)<ty)k+='s';}
  if(p.y>=y-ty&&p.y<=y+h+ty){if(Math.abs(p.x-x)<tx)k+='w';else if(Math.abs(p.x-x-w)<tx)k+='e';}
  return k||(p.x>x&&p.x<x+w&&p.y>y&&p.y<y+h?'move':'new');
}
pdfCropOverlay.addEventListener('pointerdown',e=>{
  if(!pdfCropReady)return;e.preventDefault();pdfCropOverlay.setPointerCapture(e.pointerId);const p=pdfCropPoint(e);
  pdfCropDrag={start:p,old:pdfFreeCropRect?[...pdfFreeCropRect]:null,kind:pdfCropHit(p)};pdfFreeReferencePage=previewPage;
});
pdfCropOverlay.addEventListener('pointermove',e=>{
  if(!pdfCropReady)return;const p=pdfCropPoint(e);
  if(!pdfCropDrag){const k=pdfCropHit(p);pdfCropOverlay.style.cursor=k==='move'?'move':k==='new'?'crosshair':({n:'ns',s:'ns',w:'ew',e:'ew',nw:'nwse',se:'nwse',ne:'nesw',sw:'nesw'}[k]||'nwse')+'-resize';return;}
  const {start,old,kind}=pdfCropDrag,dx=p.x-start.x,dy=p.y-start.y,minW=1/pdfCropImage.naturalWidth,minH=1/pdfCropImage.naturalHeight;
  if(kind==='new'){const x=Math.min(start.x,p.x),y=Math.min(start.y,p.y);pdfFreeCropRect=[x,y,Math.min(1-x,Math.max(minW,Math.abs(dx))),Math.min(1-y,Math.max(minH,Math.abs(dy)))];}
  else if(kind==='move')pdfFreeCropRect=[Math.max(0,Math.min(1-old[2],old[0]+dx)),Math.max(0,Math.min(1-old[3],old[1]+dy)),old[2],old[3]];
  else{let[x,y,w,h]=old,right=x+w,bottom=y+h;if(kind.includes('w'))x=Math.max(0,Math.min(right-minW,old[0]+dx));if(kind.includes('e'))right=Math.min(1,Math.max(x+minW,old[0]+old[2]+dx));if(kind.includes('n'))y=Math.max(0,Math.min(bottom-minH,old[1]+dy));if(kind.includes('s'))bottom=Math.min(1,Math.max(y+minH,old[1]+old[3]+dy));pdfFreeCropRect=[x,y,right-x,bottom-y];}
  pdfDraftEnabled=true;drawPdfCrop();
});
function finishPdfCrop(){pdfCropDrag=null;if(pdfFreeCropRect&&(pdfFreeCropRect[2]<=0||pdfFreeCropRect[3]<=0))pdfFreeCropRect=null;renderPdfSteps();drawPdfCrop();}
pdfCropOverlay.addEventListener('pointerup',finishPdfCrop);pdfCropOverlay.addEventListener('pointercancel',finishPdfCrop);
pdfCropImage.addEventListener('load',()=>syncPdfFreeCrop());
$('pdf-crop-clear').onclick=()=>{pdfFreeCropRect=null;drawPdfCrop();};
$('pdf-crop-scope').addEventListener('change',()=>{pdfDraftEnabled=true;pdfCropControls();renderPdfSteps();drawPdfCrop();});
const chooseBeforeFreeCrop=choosePdfAction;
choosePdfAction=function(action){resetPdfFreeCrop();chooseBeforeFreeCrop(action);pdfCropControls();};
new ResizeObserver(()=>{if(pdfAction==='pdf-free-crop')syncPdfFreeCrop();}).observe($('pdf-preview-stage'));
