const assert = require('node:assert/strict');
const fs = require('node:fs');
const { runInNewContext } = require('node:vm');
const core = require('../extension/replies-core.js');
const payload = id => ({data:{threaded_conversation_with_injections_v2:{instructions:[{type:'TimelineAddEntries',entries:[{entryId:`tweet-${id}`,content:{itemContent:{tweet_results:{result:{rest_id:id}}}}},...Array.from({length:70},(_,i)=>({entryId:`conversationthread-${id}-${i}`,content:{items:[{entryId:`reply-${i}`,item:{itemContent:{tweet_results:{result:{rest_id:`${id}${i}`,legacy:{in_reply_to_status_id_str:id}}}}}}]}})),{entryId:'cursor-bottom',content:{cursorType:'Bottom',value:'CURSOR'}}]}]}}});
const url = id => `https://x.com/i/api/graphql/query/TweetDetail?variables=${encodeURIComponent(JSON.stringify({focalTweetId:id}))}`;
class XHR {
 constructor(){this.listeners=new Set();this.readyState=0;this.status=0;this.responseType='';this.raw='';}
 get responseText(){return this.raw;}
 get response(){return this.responseType==='json'?JSON.parse(this.raw):this.raw;}
 open(method,url){this.url=url;this.readyState=1;}
 send(body){this.body=body;}
 setRequestHeader(){}
 addEventListener(type,fn){this.listeners.add(fn);}
 removeEventListener(type,fn){this.listeners.delete(fn);}
 finish(value){this.raw=JSON.stringify(value);this.readyState=4;this.status=200;for(const f of this.listeners) f();}
}
const storage=new Map();const intervals=[];
const location={origin:'https://x.com',href:'https://x.com/a/status/100',pathname:'/a/status/100'};
const document={documentElement:{removeAttribute(){}},querySelector(){return null;},querySelectorAll(){return [];}};
let lastNativeRequest;const nativeRequests=[];
const homePayload={data:{home:{home_timeline_urt:{instructions:[{type:'TimelineAddEntries',entries:[{entryId:'tweet-42',content:{itemContent:{tweet_results:{result:{rest_id:'42',legacy:{full_text:'Home fixture'}}}}}},{entryId:'cursor-bottom',content:{cursorType:'Bottom',value:'HOME_CURSOR'}}]}]}}}};
const window={SifiReplyPages:core,fetch:async (input,init)=>{const inputUrl=input instanceof Request?input.url:String(input);lastNativeRequest={url:inputUrl,init};nativeRequests.push(lastNativeRequest);if(inputUrl.includes('/Home'))return new Response(JSON.stringify(homePayload));return new Response(JSON.stringify(payload(new URL(inputUrl).searchParams.has('variables')?JSON.parse(new URL(inputUrl).searchParams.get('variables')).focalTweetId:'100')),{status:200});}};
const sandbox={window,XMLHttpRequest:XHR,Headers,Request,Response,URL,AbortSignal,location,document,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},setTimeout:()=>{},setInterval:fn=>intervals.push(fn)};
const source=fs.readFileSync('extension/replies.js','utf8');
runInNewContext(source.replace(/\}\)\(\);\s*$/, 'window.testHomePage = async state => { current = state; return ensurePage(state, 1, new AbortController().signal); };})();'),{...sandbox,AbortController});
(async()=>{
 const response=await window.fetch(url('100'),{headers:{'authorization':'TEST_SECRET'}});
 const read=core.read(await response.json(),'100');assert.equal(read.replies.length,0);assert.equal(read.cursor,null);
 assert.equal(storage.size,0,'The AJAX reader does not persist replies or authentication');
 const xhr=new XHR();xhr.open('GET',url('100'));xhr.setRequestHeader('authorization','TEST_SECRET');xhr.finish(payload('100'));assert.equal(core.read(JSON.parse(xhr.responseText),'100').replies.length,0);
 xhr.open('GET','https://x.com/ordinary-endpoint');xhr.finish({unrelated:true});assert.deepEqual(JSON.parse(xhr.responseText),{unrelated:true},'Reusing XHR does not retain reply response getters');
 location.pathname='/home';location.href='https://x.com/home';intervals[0]();
 const prefetched=await window.fetch(url('200'));assert.equal(core.read(await prefetched.json(),'200').replies.length,0,'Prefetches are bounded before X caches them');
 location.pathname='/b/status/200';location.href='https://x.com/b/status/200';intervals[0]();
 const next=await window.fetch(url('200'));assert.equal(core.read(await next.json(),'200').replies.length,0);
 const jsonXHR=new XHR();jsonXHR.open('GET',url('200'));jsonXHR.responseType='json';jsonXHR.finish(payload('200'));assert.equal(core.read(jsonXHR.response,'200').replies.length,0);
 location.href='https://x.com/b/status/200?sifi_native_reply=200';intervals[0]();
 const nativeReply=await window.fetch(url('200'));
 const nativeRead=core.read(await nativeReply.json(),'200');
 assert.equal(nativeRead.replies.length,70,'Open reply keeps the complete native response');
 assert.equal(nativeRead.cursor,'CURSOR','Native thread retains its reply controls and cursor');
 const nativeXHR=new XHR();nativeXHR.open('GET',url('200'));nativeXHR.finish(payload('200'));
 assert.equal(core.read(JSON.parse(nativeXHR.responseText),'200').replies.length,70,'XHR also bypasses pagination on the marked reply');
 location.href='https://x.com/b/status/200';intervals[0]();
 const cleanedUrl=await window.fetch(url('200'));
 assert.equal(core.read(await cleanedUrl.json(),'200').replies.length,70,'X removing its query marker does not re-enable pagination on the same reply');
 const otherPrefetch=await window.fetch(url('300'));
 assert.equal(core.read(await otherPrefetch.json(),'300').replies.length,0,'Native bypass is limited to the opened reply');
 location.pathname='/c/status/300';location.href='https://x.com/c/status/300?sifi_native_reply=200';intervals[0]();
 const resumed=await window.fetch(url('300'));
 assert.equal(core.read(await resumed.json(),'300').replies.length,0,'Pagination resumes on other posts even with an old query marker');
 const homeXHR=new XHR();homeXHR.open('POST','https://x.com/i/api/graphql/query/HomeLatestTimeline');homeXHR.send(JSON.stringify({variables:{count:20},features:{test:true}}));homeXHR.finish(homePayload);
 assert.equal(core.readHome(JSON.parse(homeXHR.responseText)).replies.length,0,'POST Home removes native infinite rows');
 assert.equal(core.readHome(JSON.parse(homeXHR.responseText)).cursor,null,'POST Home removes infinite cursor');
 assert.equal(JSON.parse(homeXHR.body).features.test,true,'Original POST body remains untouched');
 location.pathname='/home';location.href='https://x.com/home';
 document.querySelectorAll=selector=>selector.includes('tablist')?[{getAttribute:()=> 'false'},{getAttribute:()=> 'true'}]:[];
 const homeUrl='https://x.com/i/api/graphql/query/HomeLatestTimeline';
 const postBody=JSON.stringify({variables:{count:20,seenTweetIds:['1']},features:{test:true},queryId:'query'});
 const fetchHome=await window.fetch(new Request(homeUrl,{method:'POST',body:postBody,headers:{'content-type':'application/json'}}));
 assert.equal(core.readHome(await fetchHome.json()).replies.length,0,'Fetch Request POST is also shaped');
 const state={id:'home:following',kind:'home',replies:[],cursor:'NEXT',request:{url:homeUrl,init:{method:'POST',body:postBody}}};
 await window.testHomePage(state);
 const cursorRequest=nativeRequests.find(request=>request.init?.body&&JSON.parse(request.init.body).variables.cursor==='NEXT');
 const sent=JSON.parse(cursorRequest.init.body);
 assert.equal(sent.variables.cursor,'NEXT','Next Home page sends its cursor in the JSON body');
 assert.deepEqual(sent.variables.seenTweetIds,['1']);assert.deepEqual(sent.features,{test:true});assert.equal(sent.queryId,'query');
 assert.equal(cursorRequest.url,homeUrl,'POST pagination keeps its original endpoint');
 assert.equal(JSON.parse(postBody).variables.cursor,undefined,'Original captured body is immutable');
 assert.equal(state.replies.length,1,'Cursor batch is merged into the finite reader');
 console.log('Fetch/XHR response shaping, JSON transport, reused XHR cleanup, prefetched SPA threads, original-post-only native shell, and no persistent authentication or replies passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
