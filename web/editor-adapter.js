/* Local adapter for the unmodified upstream miniPaint bundle. */
document.cookie='language=zh; path=/; SameSite=Strict';
document.cookie='theme=light; path=/; SameSite=Strict';
// miniPaint uses FileSaver anchor downloads. Route these through the host's
// native Save dialog when running inside the desktop window.
const originalAnchorClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){
  if(this.download && this.href.startsWith('blob:') && window.parent.pywebview?.api?.save_file){
    const name=this.download;
    fetch(this.href).then(r=>r.blob()).then(blob=>new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);
    })).then(data=>window.parent.pywebview.api.save_file(name,data)).then(result=>{
      if(result.saved)window.parent.toast('已保存：'+result.name);
    }).catch(e=>window.parent.toast('保存失败：'+e.message,true));
    return;
  }
  return originalAnchorClick.call(this);
};
