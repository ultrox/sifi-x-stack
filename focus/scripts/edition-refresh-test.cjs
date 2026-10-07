const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const listeners = new Map();
  const timers = new Map();
  const frames = new Map();
  let nextId = 0;
  let overlay = null;
  let modal = false;
  class Element {
    constructor(excluded = false) { this.excluded = excluded; }
    closest() { return this.excluded ? this : null; }
  }
  const attributes = new Set();
  const heading = {isConnected:true,getBoundingClientRect:()=>({left:0,top:100,width:400})};
  const status = {textContent:''};
  const document = {
    body:{},
    documentElement:{append(el){el.isConnected=true;overlay=el;},toggleAttribute(name,value){if(value)attributes.add(name);else attributes.delete(name);}},
    querySelector(selector){return selector==='sifi-edition-heading'?heading:modal?{}:null;},
    createElement(){const attrs={};return {isConnected:false,hidden:false,attrs,style:{setProperty(){}},setAttribute:(name,value)=>attrs[name]=value,attachShadow(){return this.shadowRoot={innerHTML:'',querySelector:()=>status};}};},
  };
  const window = {
    scrollY:0,
    addEventListener(type,fn,options){if(!listeners.has(type))listeners.set(type,new Map());listeners.get(type).set(fn,options);},
    removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    fetch(){throw new Error('Cosmetic refresh must never fetch');},
  };
  const location={pathname:'/home',reload(){throw new Error('Cosmetic refresh must never reload');}};
  vm.runInNewContext(fs.readFileSync('extension/edition-refresh.js','utf8'),{
    window,document,location,Element,getComputedStyle:()=>({backgroundColor:'rgb(0, 0, 0)'}),
    setTimeout:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    requestAnimationFrame:fn=>{const id=++nextId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  });
  function event(type,x=100,y=200,options={}) {
    const e={target:new Element(options.excluded),touches:type==='touchend'?[]:[{identifier:1,clientX:x,clientY:y}],cancelable:true,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...options};
    for(const fn of [...(listeners.get(type)?.keys()||[])])fn(e);
    for(const [id,fn] of [...frames]){frames.delete(id);fn();}
    return e;
  }
  function finishTimers() {for(const [id,task] of [...timers]){timers.delete(id);task.fn();}}
  return {window,location,attributes,heading,event,finishTimers,timers,status,setModal:value=>modal=value,
    get overlay(){return overlay;},moves:()=>listeners.get('touchmove')?.size||0};
}
{
  const p=setup();p.event('touchstart');assert.equal(p.moves(),0,'Disabled refresh never intercepts scrolling');
  p.window.SifiEditionRefresh.setEnabled(true);assert.ok(p.attributes.has('data-sifi-cosmetic-refresh'));
  p.event('touchstart');assert.equal(p.moves(),1);
  const drag=p.event('touchmove',100,310);assert.equal(drag.prevented,true);assert.equal(drag.stopped,true);
  const released=p.event('touchend');assert.equal(released.prevented,true);assert.equal(p.overlay.attrs['data-state'],'loading');assert.equal(p.status.textContent,'Loading…');assert.equal(p.moves(),0);
  assert.equal([...p.timers.values()][0].ms,1600,'The cosmetic delay is fixed');
  p.event('touchstart');p.event('touchmove',100,330);p.event('touchend');assert.equal(p.timers.size,1,'Repeated pulls do not extend or stack loaders');
  p.finishTimers();p.finishTimers();assert.equal(p.overlay.hidden,true);assert.equal(p.status.textContent,'');
}
for(const [name,prepare,x,y] of [
  ['below the top',p=>p.window.scrollY=500,100,350],
  ['horizontal swipe',()=>{},210,210],
  ['normal upward scrolling',()=>{},100,150],
  ['another route',p=>p.location.pathname='/notifications',100,350],
  ['fullscreen video',p=>p.location.pathname='/a/status/1/mediaViewer',100,350],
  ['open dialog',p=>p.setModal(true),100,350],
]) {
  const p=setup();p.window.SifiEditionRefresh.setEnabled(true);prepare(p);p.event('touchstart');
  assert.equal(p.event('touchmove',x,y).prevented,false,name);assert.equal(p.moves(),0,name);assert.equal(p.timers.size,0,name);
}
{
 const p=setup();p.window.SifiEditionRefresh.setEnabled(true);p.event('touchstart',100,200,{excluded:true});assert.equal(p.moves(),0,'Inputs, sliders and players stay native');
 p.event('touchstart');p.event('touchmove',100,230);p.event('touchend');assert.equal(p.overlay.attrs['data-state'],'settling','Short pulls do not load');p.finishTimers();assert.equal(p.overlay.hidden,true);
 p.event('touchstart');p.event('touchmove',100,330);p.event('touchend');p.window.SifiEditionRefresh.setEnabled(false);assert.equal(p.overlay.hidden,true);assert.equal(p.timers.size,0);assert.equal(p.moves(),0);assert.ok(!p.attributes.has('data-sifi-cosmetic-refresh'));
 p.window.SifiEditionRefresh.setEnabled(true);p.event('touchstart');p.event('touchmove',100,240,{touches:[{identifier:1,clientX:100,clientY:240},{identifier:2,clientX:150,clientY:200}]});assert.equal(p.moves(),0,'Multitouch remains available');
}
console.log('Cosmetic pull refresh: threshold, fixed delay, repeated pulls, short pulls, route cleanup, normal scrolling, dialogs, video controls and multitouch passed.');
