'use strict';
let selectedCollagePhoto=null,collageDrag=null;
const collageCanvas=$('collage-preview');
function ensureFrames(){
  const W=Number($('board-width').value),H=Number($('board-height').value);
  collageFiles.forEach((f,i)=>{if(!f.frame){const ratio=f.crop?f.crop[2]/f.crop[3]:f.image.naturalWidth/f.image.naturalHeight,w=Math.min(W*.48,600,H*.6*ratio),h=w/ratio;f.frame={x:Math.min(W-w,40+(i%3)*W*.15),y:Math.min(H-h,40+(i%3)*H*.15),w,h};}});
}
function freeCollageOptions(){
  ensureFrames();const w=Number($('board-width').value),h=Number($('board-height').value);
  if(!Number.isInteger(w)||!Number.isInteger(h)||w<300||h<300||w>6000||h>6000||w*h>40_000_000)throw Error('画布宽高须为 300 到 6000 像素，且不超过 4000 万像素');
  return {layout:'free',board_width:w,board_height:h,frames:collageFiles.map(f=>({...f.frame})),crops:collageFiles.map(f=>f.crop||null),background:$('collage-bg').value,format:$('collage-format').value};
}
function drawFreeCollage(o){
  const scale=Math.min(1,1400/Math.max(o.board_width,o.board_height));collageCanvas.width=Math.round(o.board_width*scale);collageCanvas.height=Math.round(o.board_height*scale);
  const ctx=collageCanvas.getContext('2d');ctx.fillStyle=o.background;ctx.fillRect(0,0,collageCanvas.width,collageCanvas.height);
  collageFiles.forEach(f=>{const r=f.frame,c=f.crop||[0,0,f.image.naturalWidth,f.image.naturalHeight];ctx.drawImage(f.image,...c,r.x*scale,r.y*scale,r.w*scale,r.h*scale);});
  if(selectedCollagePhoto&&collageFiles.includes(selectedCollagePhoto)){
    const r=selectedCollagePhoto.frame,x=r.x*scale,y=r.y*scale,w=r.w*scale,h=r.h*scale;
    ctx.strokeStyle='#287461';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);ctx.fillStyle='white';
    for(const [cx,cy] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){ctx.fillRect(cx-5,cy-5,10,10);ctx.strokeRect(cx-5,cy-5,10,10);}
  }
  $('collage-dimensions').textContent=`画布 ${o.board_width} × ${o.board_height} px · 拖动照片移动，拖角点缩放`;
}
function boardPoint(e){const rect=collageCanvas.getBoundingClientRect(),o=freeCollageOptions();return{x:(e.clientX-rect.left)*o.board_width/rect.width,y:(e.clientY-rect.top)*o.board_height/rect.height};}
function frameHandle(photo,p){
  if(!photo)return null;const r=photo.frame,t=14*Number($('board-width').value)/Math.max(1,collageCanvas.getBoundingClientRect().width);
  for(const [name,x,y]of[['nw',r.x,r.y],['ne',r.x+r.w,r.y],['sw',r.x,r.y+r.h],['se',r.x+r.w,r.y+r.h]])if(Math.abs(p.x-x)<t&&Math.abs(p.y-y)<t)return name;
  return null;
}
collageCanvas.style.touchAction='none';
collageCanvas.addEventListener('pointerdown',e=>{
  if($('collage-layout').value!=='free')return;const p=boardPoint(e),handle=frameHandle(selectedCollagePhoto,p);
  if(!handle){selectedCollagePhoto=[...collageFiles].reverse().find(f=>p.x>=f.frame.x&&p.x<=f.frame.x+f.frame.w&&p.y>=f.frame.y&&p.y<=f.frame.y+f.frame.h)||null;}
  if(selectedCollagePhoto){e.preventDefault();collageCanvas.setPointerCapture(e.pointerId);collageDrag={photo:selectedCollagePhoto,start:p,old:{...selectedCollagePhoto.frame},kind:handle||'move'};}
  drawFreeCollage(freeCollageOptions());
});
collageCanvas.addEventListener('pointermove',e=>{
  if($('collage-layout').value!=='free')return;const p=boardPoint(e);
  if(!collageDrag){collageCanvas.style.cursor=frameHandle(selectedCollagePhoto,p)?'nwse-resize':'grab';return;}
  const {photo,start,old,kind}=collageDrag,dx=p.x-start.x,dy=p.y-start.y,o=freeCollageOptions();
  if(Math.abs(dx)+Math.abs(dy)>5)collageDrag.moved=true;
  if(kind==='move')photo.frame={...old,x:Math.max(20-old.w,Math.min(o.board_width-20,old.x+dx)),y:Math.max(20-old.h,Math.min(o.board_height-20,old.y+dy))};
  else{
    const right=old.x+old.w,bottom=old.y+old.h;
    const rawWidth=kind.includes('w')?old.w-dx:old.w+dx;
    const w=Math.max(40,Math.min(o.board_width*2,Math.sqrt(40_000_000*old.w/old.h),rawWidth)),h=w*old.h/old.w;
    photo.frame={x:kind.includes('w')?right-w:old.x,y:kind.includes('n')?bottom-h:old.y,w,h};
  }
  drawFreeCollage(freeCollageOptions());
});
collageCanvas.addEventListener('pointerup',()=>{const drag=collageDrag;collageDrag=null;if(drag&&!drag.moved&&drag.kind==='move')openCollageCrop(drag.photo);});collageCanvas.addEventListener('pointercancel',()=>{collageDrag=null;});
document.querySelectorAll('.layout-card').forEach(button=>button.onclick=()=>{
  $('collage-layout').value=button.dataset.layout;
  document.querySelectorAll('.layout-card').forEach(b=>{const chosen=b===button;b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));});
  $('free-board-settings').hidden=button.dataset.layout!=='free';$('grid-settings').hidden=button.dataset.layout==='free';
  refreshCollage();
});
for(const id of ['board-width','board-height'])$(id).addEventListener('input',refreshCollage);
