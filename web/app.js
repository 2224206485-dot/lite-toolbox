'use strict';
const $ = id => document.getElementById(id);
let toastTimer, activeTab = 'photo', pdfAction = 'pdf-merge', photoName = 'photo', busy = false;
let collageFiles = [], pdfFiles = [], pdfSourceKind = 'pdf';
const titles = {photo:['照片编辑','只留常用的几步：裁剪、调色、保存。'],collage:['照片拼图','把旅行、生活和喜欢的瞬间，拼成一张。'],pdf:['PDF 工具','整理文件、调整页面，处理完就另存。']};
function toast(message, error=false) {
  $('toast').textContent=message; $('toast').className=error?'error':''; $('toast').style.display='block';
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').style.display='none',error?7000:3800);
}
function showTab(tab) {
  activeTab=tab;
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===tab));
  document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  [$('page-title').textContent,$('page-description').textContent]=titles[tab];
}
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$('about-button').onclick=()=>$('about').showModal();

async function fileRecord(file, image=false) {
  if(file.size>120*1024*1024) throw Error('单个文件不能超过 120 MB');
  const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('文件读取失败'));r.readAsDataURL(file);});
  const record={name:file.name,size:file.size,data:url.split(',')[1],url};
  if(image) record.image=await loadImage(url);
  return record;
}
function loadImage(url) { return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('无法读取图片，请使用 PNG、JPEG 或 WebP'));image.src=url;}); }
function formatSize(size){return size>=1024*1024?(size/1024/1024).toFixed(1)+' MB':Math.round(size/1024)+' KB';}
async function api(action, files, options={}) {
  if(files.reduce((n,f)=>n+f.size,0)>120*1024*1024) throw Error('一次处理的文件总大小不能超过 120 MB');
  const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','X-Toolbox-Token':window.TOOLBOX_TOKEN},body:JSON.stringify({action,files:files.map(({name,data})=>({name,data})),options})});
  const result=await response.json();if(!response.ok) throw Error(result.error||'处理失败');return result;
}
async function saveResult(result) {
  if(window.pywebview?.api?.save_file) {
    const saved=await window.pywebview.api.save_file(result.name,result.data);
    if(saved.cancelled) {toast('已取消保存，原文件不受影响');return;}
    toast('已保存：'+saved.name);
  } else {
    const raw=atob(result.data), bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const url=URL.createObjectURL(new Blob([bytes]));const a=document.createElement('a');a.href=url;a.download=result.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    toast('已生成文件，请在下载位置查看');
  }
}
async function withBusy(button, fn) {
  if(busy)return;busy=true;const label=button.textContent;button.disabled=true;button.textContent='正在处理…';
  try{await fn();}catch(e){toast(e.message||String(e),true);}finally{busy=false;button.disabled=false;button.textContent=label;}
}
function editorWindow() {
  const editor=$('editor').contentWindow;
  if(!editor?.Layers?.Base_gui) throw Error('编辑器正在加载，请稍候再试');
  return editor;
}
function renderFiles(container, files, onUpdate) {
  container.replaceChildren();files.forEach((f,index)=>{
    const row=document.createElement('div');row.className='file-row';
    if(f.image){const image=document.createElement('img');image.src=f.url;image.alt='';row.append(image);}
    else{const icon=document.createElement('span');icon.className='file-icon';icon.textContent='PDF';row.append(icon);}
    const meta=document.createElement('div');meta.className='file-meta';const name=document.createElement('strong');name.textContent=f.name;name.title=f.name;
    const info=document.createElement('small');info.textContent=`${String(index+1).padStart(2,'0')} · ${formatSize(f.size)}${f.pages?' · '+f.pages+' 页':''}`;meta.append(name,info);row.append(meta);
    for(const [label,title,offset] of [['↑','上移',-1],['↓','下移',1],['×','移除',0]]){
      const b=document.createElement('button');b.textContent=label;b.title=title;b.setAttribute('aria-label',`${title} ${f.name}`);
      b.disabled=offset!==0&&(index+offset<0||index+offset>=files.length);
      b.onclick=()=>{if(offset===0)files.splice(index,1);else [files[index],files[index+offset]]=[files[index+offset],files[index]];onUpdate();};row.append(b);
    }container.append(row);
  });
}
async function addCollage(fileList) {
  try{
    const incoming=Array.from(fileList);if(collageFiles.length+incoming.length>30)throw Error('拼图最多添加 30 张照片');
    for(const f of incoming){const record=await fileRecord(f,true);if(record.image.naturalWidth*record.image.naturalHeight>40_000_000)throw Error('图片不能超过 4000 万像素');collageFiles.push(record);}
  }catch(e){toast(e.message,true);}finally{refreshCollage();}
}
$('collage-input').onchange=async e=>{await addCollage(e.target.files);e.target.value='';};
function collageOptions(){
  if($('collage-layout').value==='free')return freeCollageOptions();
  const width=Number($('collage-width').value),first=collageFiles[0],firstRatio=first?(first.crop?first.crop[2]/first.crop[3]:first.image.naturalWidth/first.image.naturalHeight):1;
  const ratio=$('collage-ratio').value==='original'?firstRatio:Number($('collage-ratio').value);
  const opts={columns:$('collage-layout').value==='horizontal'?Math.max(1,collageFiles.length):Number($('collage-layout').value),cell_width:width,cell_height:Math.max(1,Math.round(width/ratio)),gap:Number($('collage-gap').value),background:$('collage-bg').value,fit:$('collage-fit').value,format:$('collage-format').value,crops:collageFiles.map(f=>f.crop||null)};
  if(!Number.isInteger(width)||width<100||width>4000)throw Error('每格宽度须为 100 到 4000 像素');
  if(opts.columns>10)throw Error('横向长图最多放 10 张照片，请改用网格或竖向长图');
  return opts;
}
function refreshCollage(){
  renderFiles($('collage-files'),collageFiles,refreshCollage);$('collage-empty').hidden=!!collageFiles.length;
  $('collage-preview-wrap').hidden=!collageFiles.length;$('gap-value').textContent=$('collage-gap').value+' px';
  if(!collageFiles.length){$('collage-dimensions').textContent='添加照片后显示成品尺寸';return;}
  try{
    const o=collageOptions();
    if(o.layout==='free'){drawFreeCollage(o);return;}
    const rows=Math.ceil(collageFiles.length/o.columns);
    const width=o.cell_width*o.columns+o.gap*(o.columns+1),height=o.cell_height*rows+o.gap*(rows+1);
    if(width*height>40_000_000)throw Error('成品超过 4000 万像素，请减小每格宽度');
    $('collage-dimensions').textContent=`成品 ${width} × ${height} px · ${collageFiles.length} 张照片`;
    const scale=Math.min(1,1200/Math.max(width,height)),canvas=$('collage-preview');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle=o.background;ctx.fillRect(0,0,canvas.width,canvas.height);
    collageFiles.forEach((f,i)=>{
      const im=f.image, x=(o.gap+(i%o.columns)*(o.cell_width+o.gap))*scale,y=(o.gap+Math.floor(i/o.columns)*(o.cell_height+o.gap))*scale;
      const cw=o.cell_width*scale,ch=o.cell_height*scale;
      const crop=f.crop||[0,0,im.naturalWidth,im.naturalHeight],factor=o.fit==='cover'?Math.max(cw/crop[2],ch/crop[3]):Math.min(cw/crop[2],ch/crop[3]);
      const iw=crop[2]*factor,ih=crop[3]*factor;
      ctx.save();ctx.beginPath();ctx.rect(x,y,cw,ch);ctx.clip();ctx.drawImage(im,...crop,x+(cw-iw)/2,y+(ch-ih)/2,iw,ih);ctx.restore();
    });
  }catch(e){$('collage-dimensions').textContent=e.message;}
}
['collage-layout','collage-ratio','collage-width','collage-fit','collage-gap','collage-bg','collage-format'].forEach(id=>$(id).addEventListener('input',refreshCollage));
$('export-collage').onclick=()=>withBusy($('export-collage'),async()=>saveResult(await api('collage',collageFiles,collageOptions())));

const pdfDescriptions={
  'pdf-merge':['按顺序合成一份 PDF','添加 PDF，调整文件顺序，然后另存。','合并结果按左侧文件顺序排列，保留页面尺寸。'],
  'pdf-extract':['提取页面，也能重新排序','添加一个 PDF，输入需要保留的页码。','可输入 3,1,2 重新排序，或 1-3,5 提取指定页面；支持倒序 5-1。'],
  'pdf-split':['把每页拆成独立文件','添加一个 PDF，选择需要拆分的页码。','每页保存为一个 PDF，所有页面打包为 ZIP。'],
  'pdf-delete':['移除不需要的页面','添加一个 PDF，填写要删除的页码。','必须保留至少一页。删除操作只作用于另存的新文件。'],
  'pdf-rotate':['把页面转到正确方向','添加一个 PDF，选择页码和旋转角度。','选中的页面顺时针旋转，其他页面保持原样。'],
  'pdf-crop':['收起页面四周的白边','添加一个 PDF，设置四周裁去的距离。','按固定距离裁四边；不自动识别白边，不适合用来永久删除敏感信息。'],
  'pdf-free-crop':['自由裁剪 PDF 页面','在页面上拖动选择保留区域，拖选区移动，拖边角调整。','右侧小图实时显示裁剪结果。加入操作后可继续修改，最后统一保存。裁剪只改变可见范围，不会永久删除被遮住的内容。'],
  'pdf-optimize':['整理 PDF 内部结构','添加一个 PDF，尝试无损减小文件体积。','压缩内容流、合并重复对象；扫描图片不降采样，体积可能不变或增大。'],
  'images-pdf':['把照片整理成 PDF','添加照片，按顺序一张一页。','支持 PNG、JPEG 和 WebP，透明区域使用白色背景。']
};
function choosePdfAction(action){
  if(action==='images-pdf' && pdfSourceKind!=='images' && pdfFiles.length){if(!confirm('添加照片需要清空当前 PDF 列表与待保存操作，继续吗？'))return;pdfFiles=[];}
  if(!pdfFiles.length)pdfSourceKind=action==='images-pdf'?'images':'pdf';
  if(pdfAction!==action)$('pdf-pages').value='';
  pdfAction=action;document.querySelectorAll('.tool').forEach(b=>b.classList.toggle('active',b.dataset.action===action));
  const d=pdfDescriptions[action];$('pdf-heading').textContent=d[0];$('pdf-subtitle').textContent=d[1];$('pdf-operation-hint').textContent=d[2];
  $('pdf-input').accept=pdfSourceKind==='images'?'image/png,image/jpeg,image/webp':'.pdf';
  $('pdf-pages-group').hidden=['pdf-merge','pdf-optimize','images-pdf'].includes(action);
  $('pdf-angle-group').hidden=action!=='pdf-rotate';$('pdf-margin-group').hidden=action!=='pdf-crop';
  $('pdf-pages-label').textContent=action==='pdf-delete'?'要删除的页码':'选择页码';
  $('pages-hint').textContent=action==='pdf-delete'?'请填写页码，例如 2,4-6。':'留空表示全部页面，页码从 1 开始。';
  refreshPdf();
}
document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>choosePdfAction(b.dataset.action));
async function addPdf(fileList){
  try{
    const incoming=Array.from(fileList),image=pdfSourceKind==='images';
    for(const file of incoming){
      if(!image&&!file.name.toLowerCase().endsWith('.pdf'))throw Error('请添加 PDF 文件');
      const record=await fileRecord(file,image);
      if(!image){const info=await api('pdf-info',[record]);record.pages=info.files[0].pages;}
      pdfFiles.push(record);
    }
  }catch(e){toast(e.message,true);}finally{refreshPdf();}
}
$('pdf-input').onchange=async e=>{await addPdf(e.target.files);e.target.value='';};
function refreshPdf(){
  renderFiles($('pdf-files'),pdfFiles,refreshPdf);$('pdf-empty').hidden=!!pdfFiles.length;
  $('pdf-summary').textContent=pdfFiles.length?`${pdfFiles.length} 个文件 · ${pdfSourceKind==='images'?pdfFiles.length:pdfFiles.reduce((n,f)=>n+(f.pages||0),0)} 页 · ${formatSize(pdfFiles.reduce((n,f)=>n+f.size,0))}`:'尚未添加文件';
}
$('clear-pdf').onclick=()=>{pdfFiles=[];refreshPdf();};
$('run-pdf').onclick=()=>withBusy($('run-pdf'),async()=>{
  if(!pdfFiles.length)throw Error('请先添加文件');
  if(pdfAction==='pdf-delete'&&!$('pdf-pages').value.trim())throw Error('请填写要删除的页码');
  const options={pages:$('pdf-pages').value,angle:Number($('pdf-angle').value),margin_mm:Number($('pdf-margin').value)};
  const result=await api(pdfAction,pdfFiles,options);await saveResult(result);
});
for(const id of ['pdf','collage']){
  $(id).addEventListener('dragover',e=>{e.preventDefault();});
  $(id).addEventListener('drop',async e=>{e.preventDefault();if(id==='pdf')await addPdf(e.dataTransfer.files);else await addCollage(e.dataTransfer.files);});
}
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='文件正在处理中';}});
