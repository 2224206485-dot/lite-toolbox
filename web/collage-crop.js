'use strict';
let cropPhoto=null,modalCropBox=null,modalCropRatio=null,modalCropDrag=null;
const cropModal=$('collage-crop-dialog'),cropModalImage=$('collage-crop-image'),cropModalCanvas=$('collage-crop-overlay');
function openCollageCrop(photo){
  cropPhoto=photo;modalCropBox=photo.crop?{x:photo.crop[0],y:photo.crop[1],w:photo.crop[2],h:photo.crop[3]}:null;modalCropRatio=null;
  $('collage-crop-name').textContent=photo.name;cropModalImage.src=photo.url;cropModalImage.onload=()=>drawModalCrop();
  document.querySelectorAll('[data-crop-ratio]').forEach(b=>b.classList.toggle('selected',b.dataset.cropRatio==='free'));
  cropModal.showModal();requestAnimationFrame(drawModalCrop);
}
function drawModalCrop(){
  if(!cropPhoto)return;const W=cropPhoto.image.naturalWidth,H=cropPhoto.image.naturalHeight;
  cropModalCanvas.width=W;cropModalCanvas.height=H;const ctx=cropModalCanvas.getContext('2d'),r=modalCropBox||{x:0,y:0,w:W,h:H},u=W/Math.max(1,cropModalCanvas.getBoundingClientRect().width),handle=10*u;
  ctx.fillStyle='rgba(16,31,24,.5)';ctx.clearRect(0,0,W,H);ctx.fillRect(0,0,W,r.y);ctx.fillRect(0,r.y+r.h,W,H-r.y-r.h);ctx.fillRect(0,r.y,r.x,r.h);ctx.fillRect(r.x+r.w,r.y,W-r.x-r.w,r.h);
  ctx.strokeStyle='white';ctx.lineWidth=1.5*u;ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.lineWidth=u*.5;
  for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(r.x+i*r.w/3,r.y);ctx.lineTo(r.x+i*r.w/3,r.y+r.h);ctx.stroke();ctx.beginPath();ctx.moveTo(r.x,r.y+i*r.h/3);ctx.lineTo(r.x+r.w,r.y+i*r.h/3);ctx.stroke();}
  ctx.fillStyle='white';for(const [x,y]of[[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]])ctx.fillRect(x-handle/2,y-handle/2,handle,handle);
  $('collage-crop-dimensions').textContent=`${Math.round(r.w)} × ${Math.round(r.h)} px`;
}
function modalPoint(e){const r=cropModalCanvas.getBoundingClientRect();return{x:Math.max(0,Math.min(cropModalCanvas.width,(e.clientX-r.left)*cropModalCanvas.width/r.width)),y:Math.max(0,Math.min(cropModalCanvas.height,(e.clientY-r.top)*cropModalCanvas.height/r.height))};}
function modalHit(p){
  const r=modalCropBox;if(!r)return'new';const t=14*cropModalCanvas.width/Math.max(1,cropModalCanvas.getBoundingClientRect().width);
  for(const [name,x,y]of[['nw',r.x,r.y],['ne',r.x+r.w,r.y],['sw',r.x,r.y+r.h],['se',r.x+r.w,r.y+r.h]])if(Math.abs(p.x-x)<t&&Math.abs(p.y-y)<t)return name;
  return p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h?'move':'new';
}
function selectionFrom(anchor,p){
  const W=cropModalCanvas.width,H=cropModalCanvas.height,positiveX=p.x>=anchor.x,positiveY=p.y>=anchor.y;
  let w=Math.max(1,Math.abs(p.x-anchor.x)),h=Math.max(1,Math.abs(p.y-anchor.y));
  if(modalCropRatio){w=Math.max(w,h*modalCropRatio);w=Math.min(w,positiveX?W-anchor.x:anchor.x,(positiveY?H-anchor.y:anchor.y)*modalCropRatio);h=w/modalCropRatio;}
  return{x:positiveX?anchor.x:anchor.x-w,y:positiveY?anchor.y:anchor.y-h,w:Math.max(1,w),h:Math.max(1,h)};
}
cropModalCanvas.style.touchAction='none';
cropModalCanvas.addEventListener('pointerdown',e=>{e.preventDefault();cropModalCanvas.setPointerCapture(e.pointerId);const p=modalPoint(e);modalCropDrag={start:p,kind:modalHit(p),old:modalCropBox?{...modalCropBox}:null};});
cropModalCanvas.addEventListener('pointermove',e=>{
  const p=modalPoint(e);if(!modalCropDrag){const k=modalHit(p);cropModalCanvas.style.cursor=k==='move'?'move':k==='new'?'crosshair':['ne','sw'].includes(k)?'nesw-resize':'nwse-resize';return;}
  const {start,kind,old}=modalCropDrag,dx=p.x-start.x,dy=p.y-start.y,W=cropModalCanvas.width,H=cropModalCanvas.height;
  if(kind==='move')modalCropBox={...old,x:Math.max(0,Math.min(W-old.w,old.x+dx)),y:Math.max(0,Math.min(H-old.h,old.y+dy))};
  else if(kind==='new')modalCropBox=selectionFrom(start,p);
  else{const anchor={x:kind.includes('w')?old.x+old.w:old.x,y:kind.includes('n')?old.y+old.h:old.y};modalCropBox=selectionFrom(anchor,p);}
  drawModalCrop();
});
cropModalCanvas.addEventListener('pointerup',()=>modalCropDrag=null);cropModalCanvas.addEventListener('pointercancel',()=>modalCropDrag=null);
document.querySelectorAll('[data-crop-ratio]').forEach(button=>button.onclick=()=>{
  document.querySelectorAll('[data-crop-ratio]').forEach(b=>b.classList.toggle('selected',b===button));
  modalCropRatio=button.dataset.cropRatio==='free'?null:Number(button.dataset.cropRatio);
  if(modalCropRatio){const W=cropPhoto.image.naturalWidth,H=cropPhoto.image.naturalHeight,w=Math.min(W,H*modalCropRatio),h=w/modalCropRatio;modalCropBox={x:(W-w)/2,y:(H-h)/2,w,h};}drawModalCrop();
});
$('close-collage-crop').onclick=()=>cropModal.close();
$('restore-collage-photo').onclick=()=>{modalCropBox=null;modalCropRatio=null;drawModalCrop();document.querySelectorAll('[data-crop-ratio]').forEach(b=>b.classList.toggle('selected',b.dataset.cropRatio==='free'));};
$('apply-collage-crop').onclick=()=>{
  if(modalCropBox){const W=cropPhoto.image.naturalWidth,H=cropPhoto.image.naturalHeight,x=Math.round(modalCropBox.x),y=Math.round(modalCropBox.y);cropPhoto.crop=[x,y,Math.min(W-x,Math.max(1,Math.round(modalCropBox.w))),Math.min(H-y,Math.max(1,Math.round(modalCropBox.h)))];}
  else cropPhoto.crop=null;
  if(cropPhoto.frame){const ratio=cropPhoto.crop?cropPhoto.crop[2]/cropPhoto.crop[3]:cropPhoto.image.naturalWidth/cropPhoto.image.naturalHeight;cropPhoto.frame.h=cropPhoto.frame.w/ratio;}
  cropModal.close();refreshCollage();
};
collageCanvas.addEventListener('click',e=>{
  if($('collage-layout').value==='free'||!collageFiles.length)return;
  const o=collageOptions(),cols=o.columns,rows=Math.ceil(collageFiles.length/cols),W=cols*o.cell_width+(cols+1)*o.gap,H=rows*o.cell_height+(rows+1)*o.gap,r=collageCanvas.getBoundingClientRect();
  const x=(e.clientX-r.left)*W/r.width-o.gap,y=(e.clientY-r.top)*H/r.height-o.gap,col=Math.floor(x/(o.cell_width+o.gap)),row=Math.floor(y/(o.cell_height+o.gap));
  if(x>=0&&y>=0&&col<cols&&row<rows&&x%(o.cell_width+o.gap)<o.cell_width&&y%(o.cell_height+o.gap)<o.cell_height){const f=collageFiles[row*cols+col];if(f)openCollageCrop(f);}
});
document.querySelectorAll('[data-ratio]').forEach(button=>button.onclick=()=>{$('collage-ratio').value=button.dataset.ratio;document.querySelectorAll('[data-ratio]').forEach(b=>b.classList.toggle('selected',b===button));refreshCollage();});
document.querySelectorAll('[data-board-ratio]').forEach(button=>button.onclick=()=>{const ratio=Number(button.dataset.boardRatio);$('board-height').value=Math.round(Number($('board-width').value)/ratio);document.querySelectorAll('[data-board-ratio]').forEach(b=>b.classList.toggle('selected',b===button));refreshCollage();});
