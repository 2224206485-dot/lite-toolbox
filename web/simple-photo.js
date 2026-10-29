'use strict';
let currentPhoto=null, cropBox=null, cropping=false, cropDrag=null;
const photoImage=$('simple-photo'), overlay=$('crop-overlay');
function photoFilter(){
  const values=['brightness','contrast','saturation'].map(key=>{
    const value=Number($('photo-'+key).value);$(key+'-value').value=(value>0?'+':'')+value;return 1+value/100;
  });
  photoImage.style.filter=`brightness(${values[0]}) contrast(${values[1]}) saturate(${values[2]})`;
}
function photoOptions(){return {brightness:1+Number($('photo-brightness').value)/100,contrast:1+Number($('photo-contrast').value)/100,saturation:1+Number($('photo-saturation').value)/100,format:$('photo-format').value,...(cropBox?{crop:[Math.round(cropBox.x),Math.round(cropBox.y),Math.round(cropBox.w),Math.round(cropBox.h)]}:{})};}
function cropInfo(){if(!currentPhoto)return;const w=cropBox?Math.round(cropBox.w):currentPhoto.image.naturalWidth,h=cropBox?Math.round(cropBox.h):currentPhoto.image.naturalHeight;$('photo-output-size').textContent=`保存尺寸 ${w} × ${h} px`;$('crop-size').textContent=`${w} × ${h} px`;}
function displayPhoto(){
  if(!currentPhoto)return;
  const im=currentPhoto.image,w=im.naturalWidth,h=im.naturalHeight;
  photoImage.style.clipPath='none';photoImage.style.margin='';photoImage.style.maxWidth='';photoImage.style.maxHeight='';photoImage.style.width='';
  if(cropBox&&!cropping){
    const scale=Math.min(1,Math.max(200,$('photo-stage').clientWidth-55)/cropBox.w,420/cropBox.h);
    photoImage.style.width=`${w*scale}px`;photoImage.style.maxWidth='none';photoImage.style.maxHeight='none';
    photoImage.style.margin=`${-cropBox.y*scale}px ${-(w-cropBox.x-cropBox.w)*scale}px ${-(h-cropBox.y-cropBox.h)*scale}px ${-cropBox.x*scale}px`;
    photoImage.style.clipPath=`inset(${cropBox.y}px ${w-cropBox.x-cropBox.w}px ${h-cropBox.y-cropBox.h}px ${cropBox.x}px)`;
    // clip-path uses image's displayed pixel coordinates, unlike the stored source crop.
    photoImage.style.clipPath=`inset(${cropBox.y*scale}px ${(w-cropBox.x-cropBox.w)*scale}px ${(h-cropBox.y-cropBox.h)*scale}px ${cropBox.x*scale}px)`;
  }
  overlay.hidden=!cropping;$('crop-actions').hidden=!cropping;$('quick-crop').classList.toggle('selected',cropping);
  $('quick-crop').textContent=cropping?'✂ 正在裁剪':'✂ 自由裁剪';cropInfo();if(cropping)requestAnimationFrame(drawCrop);
}
function drawCrop(){
  if(!currentPhoto||!cropping)return;
  const w=currentPhoto.image.naturalWidth,h=currentPhoto.image.naturalHeight;
  overlay.width=w;overlay.height=h;const ctx=overlay.getContext('2d'),r=cropBox||{x:0,y:0,w,h};
  const unit=w/Math.max(1,overlay.getBoundingClientRect().width),line=1.5*unit,size=9*unit;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(13,27,22,.48)';
  ctx.fillRect(0,0,w,r.y);ctx.fillRect(0,r.y+r.h,w,h-r.y-r.h);ctx.fillRect(0,r.y,r.x,r.h);ctx.fillRect(r.x+r.w,r.y,w-r.x-r.w,r.h);
  ctx.strokeStyle='white';ctx.lineWidth=line;ctx.strokeRect(r.x,r.y,r.w,r.h);
  ctx.lineWidth=unit*.6;ctx.strokeStyle='rgba(255,255,255,.65)';for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(r.x+r.w*i/3,r.y);ctx.lineTo(r.x+r.w*i/3,r.y+r.h);ctx.stroke();ctx.beginPath();ctx.moveTo(r.x,r.y+r.h*i/3);ctx.lineTo(r.x+r.w,r.y+r.h*i/3);ctx.stroke();}
  ctx.fillStyle='white';for(const [x,y] of [[r.x,r.y],[r.x+r.w/2,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h/2],[r.x+r.w,r.y+r.h/2],[r.x,r.y+r.h],[r.x+r.w/2,r.y+r.h],[r.x+r.w,r.y+r.h]]){ctx.fillRect(x-size/2,y-size/2,size,size);}
  cropInfo();
}
function cropPoint(e){const r=overlay.getBoundingClientRect();return {x:Math.max(0,Math.min(overlay.width,(e.clientX-r.left)*overlay.width/r.width)),y:Math.max(0,Math.min(overlay.height,(e.clientY-r.top)*overlay.height/r.height))};}
function hitCrop(p){
  const r=cropBox;if(!r)return 'new';const tolerance=12*overlay.width/Math.max(1,overlay.getBoundingClientRect().width);
  const nearX=p.x>=r.x-tolerance&&p.x<=r.x+r.w+tolerance,nearY=p.y>=r.y-tolerance&&p.y<=r.y+r.h+tolerance;
  let handle='';if(nearX&&Math.abs(p.y-r.y)<tolerance)handle+='n';else if(nearX&&Math.abs(p.y-r.y-r.h)<tolerance)handle+='s';
  if(nearY&&Math.abs(p.x-r.x)<tolerance)handle+='w';else if(nearY&&Math.abs(p.x-r.x-r.w)<tolerance)handle+='e';
  if(handle)return handle;return p.x>r.x&&p.x<r.x+r.w&&p.y>r.y&&p.y<r.y+r.h?'move':'new';
}
overlay.addEventListener('pointerdown',e=>{if(!cropping)return;e.preventDefault();overlay.setPointerCapture(e.pointerId);const p=cropPoint(e);cropDrag={start:p,old:cropBox?{...cropBox}:null,kind:hitCrop(p)};if(cropDrag.kind==='new')cropBox={x:p.x,y:p.y,w:1,h:1};});
overlay.addEventListener('pointermove',e=>{
  if(!cropping)return;const p=cropPoint(e);
  if(!cropDrag){const kind=hitCrop(p);overlay.style.cursor=kind==='move'?'move':kind==='new'?'crosshair':({n:'ns',s:'ns',w:'ew',e:'ew',nw:'nwse',se:'nwse',ne:'nesw',sw:'nesw'}[kind]||'nwse')+'-resize';return;}
  const {start,old,kind}=cropDrag,dx=p.x-start.x,dy=p.y-start.y,W=overlay.width,H=overlay.height;
  if(kind==='new')cropBox={x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.max(1,Math.abs(dx)),h:Math.max(1,Math.abs(dy))};
  else if(kind==='move')cropBox={...old,x:Math.max(0,Math.min(W-old.w,old.x+dx)),y:Math.max(0,Math.min(H-old.h,old.y+dy))};
  else{let x=old.x,y=old.y,right=old.x+old.w,bottom=old.y+old.h;if(kind.includes('w'))x=Math.max(0,Math.min(right-2,old.x+dx));if(kind.includes('e'))right=Math.min(W,Math.max(x+2,old.x+old.w+dx));if(kind.includes('n'))y=Math.max(0,Math.min(bottom-2,old.y+dy));if(kind.includes('s'))bottom=Math.min(H,Math.max(y+2,old.y+old.h+dy));cropBox={x,y,w:right-x,h:bottom-y};}
  drawCrop();
});
function finishDrag(){if(cropDrag&&cropBox){cropBox.x=Math.round(cropBox.x);cropBox.y=Math.round(cropBox.y);cropBox.w=Math.min(overlay.width-cropBox.x,Math.max(1,Math.round(cropBox.w)));cropBox.h=Math.min(overlay.height-cropBox.y,Math.max(1,Math.round(cropBox.h)));}cropDrag=null;if(cropping)drawCrop();}
overlay.addEventListener('pointerup',finishDrag);overlay.addEventListener('pointercancel',finishDrag);
async function openSimplePhoto(file){
  if(!file)return;try{const record=await fileRecord(file,true);if(record.image.naturalWidth*record.image.naturalHeight>40_000_000)throw Error('图片超过 4000 万像素');currentPhoto=record;cropBox=null;cropping=false;
    photoImage.src=record.url;photoImage.onload=()=>displayPhoto();$('photo-empty').hidden=true;$('photo-image-wrap').hidden=false;$('photo-live-label').hidden=false;
    ['brightness','contrast','saturation'].forEach(k=>$('photo-'+k).value=0);photoFilter();$('photo-status').textContent=`${record.name} · ${record.image.naturalWidth} × ${record.image.naturalHeight}`;displayPhoto();
  }catch(e){toast(e.message,true);}
}
$('photo-input').onchange=async e=>{await openSimplePhoto(e.target.files[0]);e.target.value='';};
$('quick-crop').onclick=()=>{if(!currentPhoto)return toast('先打开一张照片');cropping=!cropping;displayPhoto();};
$('crop-all').onclick=()=>{cropBox=null;drawCrop();};
$('crop-done').onclick=()=>{cropping=false;displayPhoto();};
$('reset-photo').onclick=()=>{cropBox=null;cropping=false;['brightness','contrast','saturation'].forEach(k=>$('photo-'+k).value=0);photoFilter();displayPhoto();};
['brightness','contrast','saturation'].forEach(k=>$('photo-'+k).oninput=photoFilter);
$('export-photo').onclick=()=>withBusy($('export-photo'),async()=>{if(!currentPhoto)throw Error('先打开一张照片');finishDrag();await saveResult(await api('image-edit',[currentPhoto],photoOptions()));});
$('photo-stage').addEventListener('dragover',e=>e.preventDefault());$('photo-stage').addEventListener('drop',e=>{e.preventDefault();openSimplePhoto(e.dataTransfer.files[0]);});
$('advanced-editor').addEventListener('toggle',()=>{if($('advanced-editor').open&&!$('editor').getAttribute('src'))$('editor').src=$('editor').dataset.src;});
new ResizeObserver(()=>{if(cropping)drawCrop();}).observe($('photo-stage'));
