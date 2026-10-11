const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const jev=require('../extension/jev-core.js'),core=require('../extension/editions-core.js');
const post={id:'123',text:'New processor released with benchmark results.',quote:'',media:[]};
const answer=()=>({model:'test-jev',answers:Object.fromEntries(Object.entries(jev.fields).map(([key,values])=>{const choices=Object.keys(values),choice=choices[0];return [key,{type:'choice',choice,confidence:.9,probabilities:Object.fromEntries(choices.map(v=>[v,v===choice?1:0]))}]}))});
assert.equal(jev.parse(answer()).verdict,'keep');
const uncertain=answer();uncertain.answers.context.choice='missing';uncertain.answers.context.probabilities={enough:0,missing:1};assert.equal(jev.parse(uncertain).verdict,'flag');
assert.throws(()=>jev.parse({answers:{}}));
assert.ok(!JSON.stringify(jev.request(post)).includes('"123"'),'Provider does not receive post/account IDs');
const tweet={rest_id:'123',legacy:{full_text:post.text},core:{user_results:{result:{legacy:{protected:false}}}}};
const item={entryId:'tweet-123',content:{itemContent:{tweet_results:{result:tweet}}}};
const record={schema:1,account:'999',feed:'for-you',edition:'100',capturedAt:100,nextAt:200,count:1,payload:{data:{home:{home_timeline_urt:{instructions:[{type:'TimelineAddEntries',entries:[item]}]}}}}};
assert.equal(jev.posts(record).length,1);
const protectedRecord=structuredClone(record);protectedRecord.payload.data.home.home_timeline_urt.instructions[0].entries[0].content.itemContent.tweet_results.result.core.user_results.result.legacy.protected=true;assert.equal(jev.posts(protectedRecord).length,0);
const mixed=structuredClone(protectedRecord);mixed.payload.data.home.home_timeline_urt.instructions[0].entries.push({...item,entryId:'second',content:{itemContent:{tweet_results:{result:{rest_id:'456',legacy:{full_text:'Second post'}}}}}});
assert.equal(jev.posts(mixed,1).length,0,'Excluded protected posts do not expand the edition budget');
assert.equal(jev.posts(mixed,2).length,1);
function worker(data,fetcher){
 let listener;
 const chrome={runtime:{id:'extension',onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,structuredClone(data[k])])),set:async values=>Object.assign(data,structuredClone(values))}}};
 vm.runInNewContext(fs.readFileSync('extension/jev-store.js','utf8'),{chrome,core,SifiJev:jev,importScripts(){},fetch:fetcher,URL,AbortSignal,Date,Map,Promise});
 const send=(action='assess',extra={})=>new Promise(resolve=>listener({type:'sifi-jev',action,account:'999',postId:'123',...extra},{id:'extension',url:'https://x.com/home'},resolve));
 return {send};
}
(async()=>{
 const data={'sifi.edition.999.for-you':record,[jev.SETTINGS]:{enabled:true},[jev.KEY]:'fixture-not-secret'};let calls=0;
 const fetcher=async(url,init)=>{calls++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(init.headers.Authorization,'Bearer fixture-not-secret');return {ok:true,status:200,text:async()=>JSON.stringify(answer())}};
 const a=worker(data,fetcher);
 const [one,two]=await Promise.all([a.send(),a.send()]);assert.deepEqual(one,two);assert.equal(calls,1);
 assert.ok(!JSON.stringify(one).includes('fixture-not-secret'));
 assert.deepEqual(JSON.parse(JSON.stringify(one.value.log.request)),jev.request(jev.posts(record)[0]));
 assert.deepEqual(JSON.parse(one.value.log.response),answer());
 assert.equal(one.value.log.status,200);
 assert.ok(one.value.log.finishedAt>=one.value.log.startedAt);
 const rejectedData={'sifi.edition.999.for-you':record,[jev.SETTINGS]:{enabled:true},[jev.KEY]:'fixture-not-secret'};
 const rejected=await worker(rejectedData,async()=>({ok:false,status:401,text:async()=>'{"error":"fixture-not-secret"}'})).send();
 assert.equal(rejected.value.log.status,401);
 assert.equal(JSON.parse(rejected.value.log.response).error,'[REDACTED]');
 assert.ok(!JSON.stringify(rejected).includes('fixture-not-secret'));

 await a.send();assert.equal(calls,1,'Repeated requests hit persistent cache');
 const b=worker(data,fetcher);await b.send();assert.equal(calls,1,'Worker/browser restarts hit persistent cache');
 const corrected=await b.send('correct',{verdict:'flag'});assert.equal(corrected.value.correction,'flag');assert.equal(calls,1,'Corrections never invoke JEV');
 const changed=structuredClone(record);changed.edition='200';changed.payload.data.home.home_timeline_urt.instructions[0].entries[0].content.itemContent.tweet_results.result.legacy.full_text='Edited text';data['sifi.edition.999.for-you']=changed;
 await b.send();assert.equal(calls,1,'New editions and edited text do not rerate the same post');
 assert.ok((await b.send('assess',{postId:'456'})).error);assert.equal(calls,1,'Posts outside the saved edition cannot call the API');
 const failData={'sifi.edition.999.for-you':record,[jev.SETTINGS]:{enabled:true},[jev.KEY]:'test'};let failures=0;
 const failure=worker(failData,async()=>{failures++;throw new Error('Error containing secret token')});
 const error=await failure.send();assert.ok(!JSON.stringify(error).includes('secret token'));await worker(failData,fetcher).send();assert.equal(failures,1);assert.equal(calls,1,'Failures are not retried on restart');
 const pendingData={'sifi.edition.999.for-you':record,[jev.SETTINGS]:{enabled:true},[jev.KEY]:'test',[jev.CACHE+'999.123']:{error:'Pending attempt'}};
 await worker(pendingData,fetcher).send();assert.equal(calls,1,'A pre-dispatch marker blocks duplicate work after interruption');
 const before=calls;
 const [redo,duplicate]=await Promise.all([b.send('reassess'),b.send('reassess')]);
 assert.equal(calls,before+1,'Concurrent explicit reassessments share one request');
 assert.deepEqual(redo,duplicate);
 assert.equal(redo.value.log.request.state.post.text,'Edited text','Reassessment uses current saved post and contract');
 assert.equal(redo.value.correction,undefined,'Reassessment replaces old correction');
 await worker(data,fetcher).send();assert.equal(calls,before+1,'New assessment remains cached after restart');
 failData[jev.KEY]='fixture-not-secret';
 const failedRedo=await worker(failData,fetcher).send('reassess');
 assert.ok(failedRedo.value.result,'Explicit reassessment can retry a cached failure');
 const savedBefore=JSON.stringify(data[jev.CACHE+'999.123']);
 data[jev.SETTINGS]={enabled:false};
 assert.ok((await b.send('reassess')).error);
 assert.equal(JSON.stringify(data[jev.CACHE+'999.123']),savedBefore,'Invalid configuration must not invalidate cache');
 assert.ok((await b.send('reassess',{postId:'456'})).error,'Reassessment still enforces edition membership');
 console.log('JEV contract validation, protected-post exclusion, persistent caching, concurrent deduplication, restart/edition reuse, local corrections, failure redaction and interrupted-attempt caching passed.');
})().catch(e=>{console.error(e);process.exitCode=1});

const named=structuredClone(record);
const namedTweet=named.payload.data.home.home_timeline_urt.instructions[0].entries[0].content.itemContent.tweet_results.result;
namedTweet.core.user_results.result={core:{name:'Tim 🙂',screen_name:'MasterTimBlais'}};
namedTweet.quoted_status_result={result:{rest_id:'789',legacy:{full_text:'Quoted context'},core:{user_results:{result:{legacy:{name:'Example channel',screen_name:'example'}}}}}};
const extracted=jev.posts(named)[0];
assert.deepEqual(extracted.author,{name:'Tim 🙂',handle:'@MasterTimBlais'});
assert.deepEqual(jev.request(extracted).state.post.quoted_author,{name:'Example channel',handle:'@example'});
assert.equal(jev.request(extracted).state.post.author.handle,'@MasterTimBlais');
namedTweet.quoted_status_result.result.core.user_results.result.legacy.protected=true;
assert.equal(jev.posts(named)[0].quotedAuthor,null);
assert.equal(jev.posts(named)[0].quote,'');
const cached=jev.parse(answer());
assert.equal(jev.presentation({result:{...cached,context:'missing',verdict:'flag'}}).confidence,'high');
assert.equal(jev.presentation({result:{...cached,verdictConfidence:.4,verdict:'flag'}}).tone,'neutral');
assert.equal(jev.presentation({result:{...cached,attention:'hype',verdict:'flag'}}).confidence,'high');
assert.equal(jev.presentation({result:{...cached,context:'missing'},correction:'keep'}).category,'World');

const transparent={result:{...cached,rawVerdict:'keep',verdict:'flag',verdictConfidence:.45}};
assert.equal(jev.presentation(transparent).confidence,'low');
assert.ok(jev.explanation(transparent).some(s=>s.includes('not been validated')));
assert.ok(jev.explanation(transparent).some(s=>s.includes('changed “Keep” to “Flag”')));
assert.ok(jev.explanation({result:{...cached,context:'missing'}}).some(s=>s.includes('not evidence of attention bait')));
assert.ok(jev.explanation({...transparent,correction:'keep'}).some(s=>s.includes('Your override: Keep')));

for(const [score,band] of [[0,'low'],[.649,'low'],[.65,'medium'],[.849,'medium'],[.85,'high'],[1,'high']]){
 const badge=jev.presentation({result:{...cached,verdictConfidence:score}});
 assert.equal(badge.confidence,band);assert.equal(badge.title,'');assert.ok(badge.description.includes('not factual accuracy'));
}
assert.equal(jev.presentation({error:'Unavailable'}).confidence,'unknown');
