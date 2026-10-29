const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const nodes=new Map();
function $(id){
  if(!nodes.has(id))nodes.set(id,{value:id==='pdf-crop-scope'?'current':'',style:{},hidden:false,complete:true,naturalWidth:800,naturalHeight:600,clientHeight:450,
    events:{},addEventListener(k,f){this.events[k]=f},setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:400,height:300}},
    getContext(){return {clearRect(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},drawImage(){}}}});
  return nodes.get(id);
}
const ctx={$ ,console,pdfAction:'pdf-free-crop',pdfDraftEnabled:true,pdfFiles:[{}],pdfSteps:[],previewPage:2,pdfPreviewLoading:false,sourceSignature:()=> 'source',renderPdfSteps(){},choosePdfAction(){},ResizeObserver:class{observe(){}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/pdf-free-crop.js'),'utf8'),ctx);
vm.runInContext('syncPdfFreeCrop({width:600,height:450})',ctx);
const c=$('pdf-crop-overlay'),ev=(x,y)=>({clientX:x,clientY:y,pointerId:1,preventDefault(){}});
function check(expected){const r=JSON.parse(vm.runInContext('JSON.stringify(pdfFreeCropRect)',ctx));r.forEach((v,i)=>assert(Math.abs(v-expected[i])<1e-8,`${r} != ${expected}`));}
c.events.pointerdown(ev(40,30));c.events.pointermove(ev(240,210));c.events.pointerup();check([.1,.1,.5,.6]);
c.events.pointerdown(ev(140,100));c.events.pointermove(ev(180,130));c.events.pointerup();check([.2,.2,.5,.6]);
c.events.pointerdown(ev(280,240));c.events.pointermove(ev(320,270));c.events.pointerup();check([.2,.2,.6,.7]);
assert.equal(vm.runInContext('pdfFreeCropOptions().pages',ctx),'3');
$('pdf-crop-scope').value='all';assert.equal(vm.runInContext('pdfFreeCropOptions().pages',ctx),'');
$('pdf-crop-scope').value='pages';$('pdf-pages').value='1,3';assert.equal(vm.runInContext('pdfFreeCropOptions().pages',ctx),'1,3');
$('pdf-pages').value='';assert.throws(()=>vm.runInContext('pdfFreeCropOptions()',ctx));
ctx.previewPage=0;vm.runInContext('syncPdfFreeCrop()',ctx);assert.equal(vm.runInContext('pdfFreeCropRect',ctx),null);
console.log('PDF free crop: drag, move, resize, current/range/all pages, page-change reset passed');
