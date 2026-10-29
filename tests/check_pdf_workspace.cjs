const fs=require('fs'),vm=require('vm'),assert=require('assert');
const nodes=new Map();
function $(id){if(!nodes.has(id))nodes.set(id,{value:id==='pdf-angle'?'90':id==='pdf-margin'?'5':'',textContent:'',disabled:false,events:{},replaceChildren(){this.children=[]},append(x){(this.children??=[]).push(x)},addEventListener(k,f){this.events[k]=f}});return nodes.get(id)}
const ctx={$ ,console,document:{createElement(){return{}}},confirm:()=>true,toast(){},withBusy:async(b,f)=>f(),api:async()=>({}),saveResult:async()=>{},schedulePreview(){},refreshPdf(){},choosePdfAction(a){ctx.pdfAction=a},previewSettings(){},previewPage:0,pdfAction:'pdf-rotate',pdfFiles:[{name:'input.pdf'}],pdfSourceKind:'pdf'};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../web/pdf-workspace.js'),'utf8'),ctx);
(async()=>{
 vm.runInContext('refreshPdf()',ctx);$('pdf-pages').value='2';
 await $('add-pdf-step').onclick();
 assert.equal(vm.runInContext('pdfSteps.length',ctx),1);assert.equal(vm.runInContext('pdfDraftEnabled',ctx),false);
 assert.equal(vm.runInContext('allPdfSteps().length',ctx),1);
 vm.runInContext("choosePdfAction('pdf-crop')",ctx);$('pdf-pages').value='1';
 assert.equal(vm.runInContext('allPdfSteps().length',ctx),2);
 await $('add-pdf-step').onclick();assert.equal(vm.runInContext('pdfSteps.length',ctx),2);
 const settings=vm.runInContext('previewSettings()',ctx);assert.equal(settings.operation,'pdf-pipeline');assert.equal(settings.steps[0].action,'pdf-rotate');assert.equal(settings.steps[1].action,'pdf-crop');
 $('undo-pdf-step').onclick();assert.equal(vm.runInContext('pdfSteps.length',ctx),1);assert.equal(vm.runInContext('allPdfSteps().length',ctx),1);
 console.log('PDF workspace: accumulate operations, preview pipeline, avoid duplicate application, undo passed');
})().catch(e=>{console.error(e);process.exitCode=1});
