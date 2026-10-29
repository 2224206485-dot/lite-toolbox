'use strict';
let pdfSteps=[],pdfDraftEnabled=true,pdfSignature='',sourceSequence=0,lastPdfSources=[],sourceResetAllowed=false;
const sourceIdentities=new WeakMap();
function sourceSignature(){return pdfFiles.map(f=>{if(!sourceIdentities.has(f))sourceIdentities.set(f,++sourceSequence);return sourceIdentities.get(f);}).join(',');}
function draftStep(){return {action:pdfAction,options:pdfAction==='pdf-free-crop'?pdfFreeCropOptions():{pages:$('pdf-pages').value,angle:Number($('pdf-angle').value),margin_mm:Number($('pdf-margin').value)}};}
function allPdfSteps(){return [...pdfSteps,...(pdfDraftEnabled?[draftStep()]:[])];}
function stepName(step){
  const names={'pdf-merge':'合并文件','images-pdf':'照片转 PDF','pdf-extract':'提取 / 排序','pdf-delete':'删除页面','pdf-rotate':'旋转页面','pdf-crop':'裁剪白边','pdf-free-crop':'自由裁剪','pdf-optimize':'无损优化','pdf-split':'逐页拆分'};
  const o=step.options;return names[step.action]+(step.action==='pdf-rotate'?` ${o.angle}°`:'')+(step.action==='pdf-crop'?` ${o.margin_mm} mm`:'')+(o.pages?` · 第 ${o.pages} 页`:['pdf-merge','images-pdf','pdf-optimize'].includes(step.action)?'':' · 全部页面');
}
function renderPdfSteps(){
  $('pdf-steps').replaceChildren();pdfSteps.forEach((step,i)=>{const item=document.createElement('li');item.textContent=stepName(step);$('pdf-steps').append(item);});
  $('pdf-step-summary').textContent=pdfSteps.length?`已加入 ${pdfSteps.length} 步${pdfDraftEnabled?'，预览还包含当前设置。':'。可以继续选其他工具，最后一起保存。'}`:'预览显示当前设置，加入操作后可以接着修改。';
  $('undo-pdf-step').disabled=!pdfSteps.length;
  $('pages-hint').textContent=pdfAction==='pdf-delete'?'填写要删除的页码，按上一步处理结果计算。':'留空表示全部页面，页码按上一步处理结果从 1 开始。';
}
const baseChoosePdfAction=choosePdfAction;
choosePdfAction=function(action){
  const previousDraft=pdfDraftEnabled;
  if(action==='images-pdf'&&pdfSourceKind!=='images'&&pdfFiles.length){
    if(!confirm('添加照片需要清空当前 PDF 列表与待保存操作，继续吗？'))return;
    sourceResetAllowed=true;pdfFiles=[];
  }
  baseChoosePdfAction(action);
  if(pdfAction!==action){pdfDraftEnabled=previousDraft;return;}
  pdfDraftEnabled=true;renderPdfSteps();schedulePreview();
};
const previewRefreshPdf=refreshPdf;
refreshPdf=function(){
  const sig=sourceSignature();if(sig!==pdfSignature){
    if(pdfSteps.length&&!sourceResetAllowed&&!confirm('改变原始文件或顺序会重置待保存操作，继续吗？'))pdfFiles=lastPdfSources.slice();
    else{if(pdfSteps.length)toast('文件或顺序已变化，待保存操作已重置');pdfSteps=[];pdfDraftEnabled=true;pdfSignature=sig;}
  }
  sourceResetAllowed=false;
  lastPdfSources=pdfFiles.slice();
  previewRefreshPdf();renderPdfSteps();
};
previewSettings=function(){return {operation:'pdf-pipeline',source_kind:pdfSourceKind,steps:pdfAction==='pdf-free-crop'&&pdfDraftEnabled?pdfSteps:allPdfSteps(),page:previewPage};};
for(const id of ['pdf-pages','pdf-angle','pdf-margin'])$(id).addEventListener('input',()=>{pdfDraftEnabled=true;renderPdfSteps();});
$('add-pdf-step').onclick=()=>withBusy($('add-pdf-step'),async()=>{
  if(!pdfFiles.length)throw Error('请先添加文件');if(!pdfDraftEnabled)return toast('此操作已经加入，可以选择下一个工具');
  if(pdfAction==='pdf-free-crop'&&!pdfFreeCropRect)throw Error('请先在预览上拖动选择保留区域');
  const step=draftStep(),sig=JSON.stringify([sourceSignature(),step]);
  await api('pdf-preview',pdfFiles,previewSettings());
  if(sig!==JSON.stringify([sourceSignature(),draftStep()]))throw Error('设置已变化，请再次点击加入操作');
  pdfSteps.push(step);pdfDraftEnabled=false;if(typeof resetPdfFreeCrop==='function')resetPdfFreeCrop();renderPdfSteps();schedulePreview(false);toast('已加入操作，可以继续修改，最后统一保存');
});
$('undo-pdf-step').onclick=()=>{if(!pdfSteps.length)return;pdfSteps.pop();pdfDraftEnabled=false;renderPdfSteps();schedulePreview();};
$('run-pdf').onclick=()=>withBusy($('run-pdf'),async()=>{
  if(!pdfFiles.length)throw Error('请先添加文件');
  if(pdfAction==='pdf-free-crop'&&pdfDraftEnabled&&!pdfFreeCropRect)throw Error('请先拖动选择裁剪区域，或切换到其他工具');
  const result=await api('pdf-pipeline',pdfFiles,{source_kind:pdfSourceKind,steps:allPdfSteps()});await saveResult(result);
});
renderPdfSteps();
