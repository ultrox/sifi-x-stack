const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const handlers={};let observer;
class Element {closest(){return this;}querySelector(){return this.video||null;}querySelectorAll(){return [];}}
class Media extends Element {play(){this.paused=false;return Promise.resolve();}}
class Video extends Media {
 constructor(){super();this.paused=true;this.attrs=new Set(['autoplay','loop']);}
 closest(selector){return selector.startsWith('input')?null:this;}
 hasAttribute(a){return this.attrs.has(a);}
 removeAttribute(a){this.attrs.delete(a);}
 pause(){this.paused=true;emit('pause',this);}
}
function emit(type,target,extra={}){const e={type,target,isTrusted:true,stopImmediatePropagation(){this.stopped=true;},...extra};for(const f of handlers[type]||[])f(e);return e;}
const first=new Video(),second=new Video();
vm.runInNewContext(fs.readFileSync('extension/autoplay.js','utf8'),{HTMLMediaElement:Media,HTMLVideoElement:Video,Element,WeakSet,Date,Promise,DOMException,document:{querySelectorAll:()=>[first]},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},window:{addEventListener(t,f){(handlers[t]||=[]).push(f);}}});
(async()=>{
 assert.equal(first.hasAttribute('autoplay'),false);
 await assert.rejects(first.play(),{name:'NotAllowedError'});
 emit('click',first,{isTrusted:false});await assert.rejects(first.play());
 emit('click',first);await first.play();assert.equal(first.paused,false);
 await assert.rejects(second.play(),'Clicking one player cannot authorize another');
 first.pause();await assert.rejects(first.play(),'Paused clips cannot restart automatically');
 emit('keydown',first,{key:'Enter'});await first.play();
 emit('ended',first);await assert.rejects(first.play(),'Completion cannot loop');
 emit('click',first);await first.play();observer([{type:'attributes',attributeName:'src',target:first}]);assert.equal(first.paused,true);await assert.rejects(first.play(),'Recycled player cannot autoplay a different clip');
 second.paused=false;const blocked=emit('play',second);assert.equal(second.paused,true);assert.ok(blocked.stopped,'Native autoplay fallback is stopped');
 second.attrs.add('autoplay');observer([{type:'childList',addedNodes:[second]}]);assert.equal(second.hasAttribute('autoplay'),false);
 await new Media().play();
 console.log('Video autoplay blocking, trusted per-player intent, pause/end/source revocation, inserted videos and audio isolation passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
