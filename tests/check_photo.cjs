const fs=require('fs'),vm=require('vm'),assert=require('assert');
const elements=new Map();
function $(id){if(!elements.has(id))elements.set(id,{id,value:id.startsWith('photo-')?'0':'',style:{},hidden:false,clientWidth:900,naturalWidth:900,naturalHeight:650,classList:{toggle(){}},events:{},addEventListener(k,f){this.events[k]=f},getBoundingClientRect(){return {left:0,top:0,width:900,height:650}},setPointerCapture(){},getContext(){return {clearRect(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}}}});return elements.get(id)}
const context={$ ,console,requestAnimationFrame:f=>f(),ResizeObserver:class{observe(){}},toast(){},withBusy(){},fileRecord(){},saveResult(){},api(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../web/simple-photo.js'),'utf8'),context);
vm.runInContext("currentPhoto={image:{naturalWidth:900,naturalHeight:650}};cropping=true;drawCrop();",context);
const ev=(x,y)=>({clientX:x,clientY:y,pointerId:1,preventDefault(){}}),c=$('crop-overlay');
c.events.pointerdown(ev(50,40));c.events.pointermove(ev(450,340));c.events.pointerup();
let box=JSON.parse(vm.runInContext('JSON.stringify(cropBox)',context));assert.deepStrictEqual(box,{x:50,y:40,w:400,h:300});
c.events.pointerdown(ev(200,100));c.events.pointermove(ev(300,200));c.events.pointerup();
box=JSON.parse(vm.runInContext('JSON.stringify(cropBox)',context));assert.deepStrictEqual(box,{x:150,y:140,w:400,h:300});
c.events.pointerdown(ev(550,440));c.events.pointermove(ev(600,500));c.events.pointerup();
box=JSON.parse(vm.runInContext('JSON.stringify(cropBox)',context));assert.deepStrictEqual(box,{x:150,y:140,w:450,h:360});
vm.runInContext('cropping=false;displayPhoto()',context);
assert.equal($('simple-photo').style.width,'900px');
assert.equal($('simple-photo').style.margin,'-140px -300px -150px -150px');
console.log('Free crop: drag selection, move, corner resize and output viewport passed');
