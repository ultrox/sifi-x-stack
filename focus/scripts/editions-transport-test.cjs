const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto').webcrypto;
process.env.TZ='Europe/Zurich';
const body=JSON.stringify({variables:{count:20},features:{preserve:true}});
const url='https://x.com/i/api/graphql/query/HomeLatestTimeline';
const payload=()=>({data:{home:{home_timeline_urt:{instructions:[{type:'TimelineAddEntries',entries:Array.from({length:45},(_,i)=>({entryId:`tweet-${i}`,sortIndex:String(1000-i),content:{itemContent:{tweet_results:{result:{rest_id:String(i),legacy:{full_text:'Fixture'}}}}}})).concat({entryId:'cursor-bottom',content:{cursorType:'Bottom',value:'MORE'}})}]}}}});
const storage=new Map();const locks=new Map();
function page(start='2026-10-07T09:00:00') {
 let now=new Date(start).getTime();let calls=0;let fail=false;let lastInit;
 class DateClock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 class XHR extends EventTarget {
  constructor(){super();this.nativeState=0;this.nativeStatus=0;this.nativeText='';this.responseType='';this.timeout=0;}
  get readyState(){return this.nativeState;}get status(){return this.nativeStatus;}get statusText(){return 'OK';}get responseURL(){return this.url;}
  get responseText(){return this.nativeText;}get response(){return this.responseType==='json'?JSON.parse(this.nativeText||'null'):this.nativeText;}
  open(method,url){this.url=url;this.nativeState=1;}send(){this.nativeState=4;this.nativeStatus=200;this.nativeText='{"native":true}';this.dispatchEvent(new Event('load'));}abort(){this.nativeState=0;}
  setRequestHeader(){}getResponseHeader(){return 'native';}getAllResponseHeaders(){return 'native';}
 }
 const listeners=new Map();
 const document={cookie:'twid=u%3D123',querySelector:()=>null,querySelectorAll:()=>[],documentElement:{removeAttribute(){}}};
 const location={origin:'https://x.com',pathname:'/home',href:'https://x.com/home'};
 const window={addEventListener:(type,fn)=>{if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},fetch:async(input,init)=>{calls++;lastInit=init;if(fail)throw new Error('offline');if(String(input).includes('FavoriteTweet'))return new Response(JSON.stringify({data:{favorite_tweet:'Done'}}));return new Response(JSON.stringify(payload()));}};
 window.postMessage=message=>{
  if(message.type!=='sifi-edition-request')return;
  queueMicrotask(()=>{
   const key=`${message.account}.${message.feed}`;
   if(message.action==='put')storage.set(key,structuredClone(message.record));
   if(message.action==='react'){for(const [k,r] of storage)if(r.account===message.account)storage.set(k,require('../extension/editions-core.js').applyReaction(r,message.record));}
   for(const fn of listeners.get('message')||[])fn({source:window,origin:location.origin,data:{type:'sifi-edition-response',id:message.id,record:structuredClone(storage.get(key)||null)}});
  });
 };
 const navigator={locks:{request:(key,fn)=>{const task=(locks.get(key)||Promise.resolve()).then(fn);locks.set(key,task.catch(()=>{}));return task;}}};
 const history={pushState:(state,unused,path)=>{location.pathname=path;location.href=location.origin+path;},replaceState:(state,unused,path)=>{location.pathname=path;location.href=location.origin+path;}};
 const context=vm.createContext({window,document,location,navigator,history,XMLHttpRequest:XHR,Headers,Request,Response,URL,Event,DOMException,AbortSignal,crypto,Date:DateClock,setTimeout,clearTimeout,setInterval:()=>{},console});
 vm.runInContext(fs.readFileSync('extension/editions-core.js','utf8'),context);window.SifiEditions=context.SifiEditions;
 vm.runInContext(fs.readFileSync('extension/editions.js','utf8'),context);
 // Exercise the real ordering with the existing reply request wrapper as well.
 window.SifiReplyPages=require('../extension/replies-core.js');
 vm.runInContext(fs.readFileSync('extension/replies.js','utf8'),context);
 return {window,XHR,document,history,location,get calls(){return calls;},get lastInit(){return lastInit;},setTime:v=>now=new Date(v).getTime(),offline:()=>fail=true};
}
const fetchHome=p=>p.window.fetch(url,{method:'POST',body,headers:{authorization:'TEST_SECRET'}}).then(r=>r.json());
function xhrHome(p,type='') {
 const xhr=new p.XHR();xhr.open('POST',url);xhr.responseType=type;xhr.setRequestHeader('authorization','TEST_SECRET');
 const events=[];for(const name of ['readystatechange','load','loadend','error'])xhr.addEventListener(name,()=>events.push(name));
 return new Promise((resolve,reject)=>{xhr.addEventListener('load',()=>resolve({xhr,events}));xhr.addEventListener('error',reject);xhr.send(body);});
}
(async()=>{
 const p=page();const first=await fetchHome(p);assert.equal(p.calls,1);
 assert.equal(JSON.parse(p.lastInit.body).variables.count,40);
 const relative=await p.window.fetch('/i/api/graphql/query/HomeLatestTimeline',{method:'POST',body}).then(r=>r.json());assert.deepEqual(relative,first);assert.equal(p.calls,1);
 const second=await fetchHome(p);assert.deepEqual(second,first);assert.equal(p.calls,1,'Reload/poll requests replay without network');
 assert.equal(JSON.stringify([...storage.values()]).includes('TEST_SECRET'),false,'No authentication is persisted');
 const reloaded=page();assert.deepEqual(await fetchHome(reloaded),first);assert.equal(reloaded.calls,0,'Persistent cache survives a new document');
 const {xhr,events}=await xhrHome(reloaded,'json');assert.equal(xhr.status,200);assert.deepEqual(JSON.parse(JSON.stringify(xhr.response)),first);assert.equal(reloaded.calls,0);assert.deepEqual(events,['readystatechange','readystatechange','readystatechange','load','loadend']);
 xhr.open('GET','https://x.com/ordinary');xhr.responseType='';xhr.send();assert.equal(xhr.responseText,'{"native":true}','Reused XHR restores native getters');
 const textXHR=(await xhrHome(reloaded)).xhr;assert.deepEqual(JSON.parse(textXHR.responseText),first);assert.equal(textXHR.getResponseHeader('content-type'),'application/json;charset=utf-8');
 const cursor=await reloaded.window.fetch(url,{method:'POST',body:JSON.stringify({variables:{cursor:'MORE'}})}).then(r=>r.json());assert.equal(cursor.data.home.home_timeline_urt.instructions.length,2);assert.equal(reloaded.calls,0);
 p.setTime('2026-10-07T14:00:00');await fetchHome(p);assert.equal(p.calls,1,'A clock boundary never refreshes the active reading session');
 p.history.pushState(null,'','/compose/post');p.history.pushState(null,'','/home');await fetchHome(p);assert.equal(p.calls,1,'Opening a native compose dialog does not end the reading session');
 p.history.pushState(null,'','/notifications');p.history.pushState(null,'','/home');await fetchHome(p);assert.equal(p.calls,2,'Returning after the boundary captures the next edition');
 const a=page('2026-10-07T19:00:00'),b=page('2026-10-07T19:00:00');await Promise.all([fetchHome(a),fetchHome(b)]);assert.equal(a.calls+b.calls,1,'Two tabs capture one edition');
 const offline=page('2026-10-08T09:00:00');offline.offline();assert.deepEqual(await fetchHome(offline),first,'Offline opening can reuse the previous edition');
 const switched=page('2026-10-08T09:00:00');switched.document.cookie='twid=u%3D456';await fetchHome(switched);assert.equal(switched.calls,1,'Account changes cannot reuse another account’s edition');
 const reactions=page();await fetchHome(reactions);
 await reactions.window.fetch('https://x.com/i/api/graphql/query/FavoriteTweet',{method:'POST',body:JSON.stringify({variables:{tweet_id:'1'}})});
 await new Promise(r=>setTimeout(r,20));
 const afterLike=await fetchHome(page());
 assert.equal(afterLike.data.home.home_timeline_urt.instructions[1].entries[1].content.itemContent.tweet_results.result.legacy.favorited,true,'Successful native likes persist in the snapshot across a document reload');
 const abortPage=page();const aborted=new abortPage.XHR();let aborts=0;let loads=0;aborted.addEventListener('abort',()=>aborts++);aborted.addEventListener('load',()=>loads++);aborted.open('POST',url);aborted.send(body);aborted.abort();await new Promise(r=>setTimeout(r,20));assert.equal(aborts,1);assert.equal(loads,0);assert.equal(aborted.readyState,0);
 console.log('Edition fetch/XHR replay, zero-network reloads, persistent storage, cross-tab capture, session boundaries, offline fallback, account separation, native request reuse and abort passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
