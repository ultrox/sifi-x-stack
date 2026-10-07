const { runInNewContext } = require('node:vm');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const handlers = {};
let tick, clicked = 0, calls = 0;
class Element { closest() { return null; } }
class Video extends Element { constructor() { super(); this.paused = false; this.loop = true; } pause() { this.paused = true; } getBoundingClientRect() { return {top:0,bottom:600}; } }
const current = new Video(), other = new Video();
const viewer = {scrollTop:0,querySelectorAll:()=>[current,other],getBoundingClientRect:()=>({top:0,bottom:600}),addEventListener:(n,f)=>handlers.scroll=f,removeEventListener:()=>{}};
let showViewer = false;
const following = {getAttribute:()=> 'false',click:()=>clicked++};
const tabs = {querySelectorAll:()=>[{},following]};
const attrs = new Set();
const location = {href:'https://x.com/home',pathname:'/home'};
const history = {pushState(_,__,url) { calls++; location.href = new URL(url,location.href).href; location.pathname = new URL(location.href).pathname; },replaceState(_,__,url) { this.pushState(_,__,url); }};
runInNewContext(readFileSync('extension/focus.js','utf8'),{URL,Element,HTMLVideoElement:Video,location,history,document:{documentElement:{hasAttribute:k=>attrs.has(k),toggleAttribute:(k,on)=>on?attrs.add(k):attrs.delete(k)},querySelector:s=>s.includes('vss-')?(showViewer?viewer:null):tabs},window:{addEventListener:(n,f)=>handlers[n]=f},setInterval:f=>tick=f});
assert.equal(clicked,1);tick();assert.equal(clicked,1);
location.href='https://x.com/a/status/123/mediaViewer?currentTweet=123';location.pathname='/a/status/123/mediaViewer';showViewer=true;tick();
assert.equal(other.paused,true);assert.equal(current.loop,false);
for(const type of ['touchmove','wheel','keydown']) {let prevented=false,stopped=false;handlers[type]({type,key:'ArrowDown',target:new Element(),cancelable:true,preventDefault:()=>prevented=true,stopImmediatePropagation:()=>stopped=true});assert.ok(prevented&&stopped);}
viewer.scrollTop=600;handlers.scroll();assert.equal(viewer.scrollTop,0);
history.pushState({},'', '/a/status/456/mediaViewer?currentTweet=456');assert.equal(calls,0);
handlers.ended({target:current,stopImmediatePropagation(){}});assert.ok(current.paused);
history.pushState({},'', '/home');assert.equal(calls,1);showViewer=false;tick();assert.equal(clicked,2);
let blocked=false;handlers.touchmove({type:'touchmove',target:new Element(),cancelable:true,preventDefault:()=>blocked=true,stopImmediatePropagation(){}});assert.equal(blocked,false);
console.log('Following, swipe/wheel/key blocking, scroll pin, autoplay, and exit checks passed.');
