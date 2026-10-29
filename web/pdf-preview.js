'use strict';
let previewPage=0,previewPages=0,previewGeneration=0,previewTimer=null,pdfPreviewLoading=false;
function previewSettings(){return {pages:$('pdf-pages').value,angle:Number($('pdf-angle').value),margin_mm:Number($('pdf-margin').value),operation:pdfAction,page:previewPage};}
function previewPagination(){
  $('pdf-page-label').textContent=previewPages?`${previewPage+1} / ${previewPages}`:'— / —';
  $('pdf-prev').disabled=!previewPages||previewPage<=0;$('pdf-next').disabled=!previewPages||previewPage>=previewPages-1;
}
function schedulePreview(reset=true){
  if(typeof pdfFreeCropLoading==='function')pdfFreeCropLoading();
  clearTimeout(previewTimer);if(reset)previewPage=0;const generation=++previewGeneration;
  if(!pdfFiles.length){previewPages=0;$('pdf-result-image').hidden=true;$('pdf-preview-placeholder').hidden=false;$('pdf-preview-placeholder').textContent='调整设置后，这里自动显示实际处理结果';$('pdf-preview-status').textContent='等待添加文件';previewPagination();return;}
  pdfPreviewLoading=true;
  $('pdf-preview-status').textContent='正在更新…';$('pdf-result-image').style.opacity='.35';
  previewTimer=setTimeout(()=>refreshPreview(generation),350);
}
async function refreshPreview(generation){
  try{
    const result=await api('pdf-preview',pdfFiles,previewSettings());if(generation!==previewGeneration)return;
    pdfPreviewLoading=false;previewPages=result.pages;previewPage=result.page;
    $('pdf-result-image').src='data:image/png;base64,'+result.data;$('pdf-result-image').hidden=false;$('pdf-result-image').style.opacity='1';$('pdf-preview-placeholder').hidden=true;
    $('pdf-preview-status').textContent=`已更新 · ${Math.round(result.width)} × ${Math.round(result.height)} pt`;previewPagination();if(typeof syncPdfFreeCrop==='function')syncPdfFreeCrop(result);
  }catch(e){if(generation!==previewGeneration)return;pdfPreviewLoading=false;previewPages=0;$('pdf-result-image').hidden=true;$('pdf-preview-placeholder').hidden=false;$('pdf-preview-placeholder').textContent=e.message;$('pdf-preview-status').textContent='请检查设置';previewPagination();}
}
const originalRefreshPdf=refreshPdf;
refreshPdf=function(){originalRefreshPdf();schedulePreview();};
['pdf-pages','pdf-angle','pdf-margin'].forEach(id=>$(id).addEventListener('input',()=>{if(pdfAction!=='pdf-free-crop')schedulePreview();}));
$('pdf-prev').onclick=()=>{if(previewPage>0){previewPage--;schedulePreview(false);}};
$('pdf-next').onclick=()=>{if(previewPage+1<previewPages){previewPage++;schedulePreview(false);}};
previewPagination();
