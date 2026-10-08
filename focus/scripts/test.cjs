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
history.pushState({},'', '/home');assert.equal(calls,1);showViewer=false;tick();assert.equal(clicked,1,'Returning from a video must not reapply the Home default');
let blocked=false;handlers.touchmove({type:'touchmove',target:new Element(),cancelable:true,preventDefault:()=>blocked=true,stopImmediatePropagation(){}});assert.equal(blocked,false);
console.log('Following, swipe/wheel/key blocking, scroll pin, autoplay, and exit checks passed.');

// A document may visit Home many times and X may rebuild its native tab strip.
function homeFixture(path='/home', selected=0, ready=true) {
  let poll, clicks=0, selection=selected, tabStrip;
  const events={};
  const loc={href:`https://x.com${path}`,pathname:path};
  const remount=()=>{tabStrip={querySelectorAll:()=>[{}, {
    getAttribute:()=>selection===1?'true':'false',
    click:()=>{clicks++;selection=1;},
  }]};};
  if(ready)remount();
  const move=path=>{loc.href=new URL(path,loc.href).href;loc.pathname=new URL(loc.href).pathname;};
  const navigation={pushState:(_,__,path)=>move(path),replaceState:(_,__,path)=>move(path)};
  runInNewContext(readFileSync('extension/focus.js','utf8'),{
    URL,Element,HTMLVideoElement:Video,location:loc,history:navigation,
    document:{documentElement:{hasAttribute:()=>false,toggleAttribute(){}},querySelector:selector=>selector.includes('vss-')?null:tabStrip},
    window:{addEventListener:(type,handler)=>events[type]=handler},setInterval:handler=>poll=handler,
  });
  return {
    get clicks(){return clicks;}, get selected(){return selection;},
    chooseForYou(){selection=0;}, tick(){poll();}, remount,
    navigate(path){navigation.pushState({},'',path);},
    back(path){move(path);events.popstate();},
  };
}
const home=homeFixture();
assert.equal(home.selected,1,'A new Home document defaults to Following');
home.chooseForYou();home.tick();
assert.equal(home.selected,0,'A manual For You selection is respected');
home.remount();home.tick();
assert.equal(home.selected,0,'Rebuilding the native tab strip must not override For You');
home.navigate('/someone/status/123');home.remount();home.back('/home');home.tick();
assert.equal(home.selected,0,'Back from a post preserves For You even with a new tab strip');
assert.equal(home.clicks,1,'The default is applied only once');
home.navigate('/notifications');home.navigate('/home');
assert.equal(home.selected,0,'Other SPA navigation preserves the selected feed');
const delayed=homeFixture('/home',0,false);
assert.equal(delayed.clicks,0);delayed.tick();delayed.remount();delayed.tick();
assert.equal(delayed.selected,1,'Initial loading waits for Home tabs');
const directPost=homeFixture('/someone/status/123');
assert.equal(directPost.clicks,0);directPost.navigate('/home');
assert.equal(directPost.selected,1,'The first Home visit after a direct post gets the default');
const alreadyFollowing=homeFixture('/home',1);
assert.equal(alreadyFollowing.clicks,0,'Do not click an already-selected Following tab');
alreadyFollowing.chooseForYou();alreadyFollowing.navigate('/someone/status/123');alreadyFollowing.back('/home');
assert.equal(alreadyFollowing.selected,0,'Initially selected Following consumes the default too');
assert.equal(homeFixture('/home',0).selected,1,'A hard reload creates a new default-selection lifecycle');
console.log('Initial default, delayed tabs, manual selection, remounts, post Back, SPA navigation and hard-reload checks passed.');
