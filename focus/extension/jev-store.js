importScripts('jev-core.js');
const jev=globalThis.SifiJev;
const jevJobs=new Map();
let jevQueue=Promise.resolve();
function jevOrigin(sender){try{return /^(?:www\.|mobile\.)?(?:x|twitter)\.com$/.test(new URL(sender.url).hostname);}catch{return false;}}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='sifi-jev'||sender.id!==chrome.runtime.id||!jevOrigin(sender))return;
  if(!/^\d{1,25}$/.test(message.account)||!/^\d{1,25}$/.test(message.postId)||!['assess','reassess','correct'].includes(message.action))return;
  const jobKey=message.account+'.'+message.postId;
  async function run(){
    const all=await chrome.storage.local.get(['sifi.edition.'+message.account+'.for-you','sifi.focus.settings',jev.SETTINGS,jev.KEY]);
    const record=all['sifi.edition.'+message.account+'.for-you'];
    if(!core.valid(record,message.account,'for-you'))throw new Error('Open a saved For you edition first.');
    const post=jev.posts(core.bounded(record,all['sifi.focus.settings'])).find(p=>p.id===message.postId);
    if(!post)throw new Error('This post is not in your saved For you edition.');
    const key=jev.CACHE+jobKey;
    const cached=(await chrome.storage.local.get(key))[key];
    if(message.action==='correct'){
      if(!cached?.result||!['keep','flag','suggest_hide'].includes(message.verdict))throw new Error('Choose a correction for an existing assessment.');
      const next={...cached,correction:message.verdict};await chrome.storage.local.set({[key]:next});return next;
    }
    if(cached&&message.action!=='reassess')return cached;
    const settings=all[jev.SETTINGS];
    if(!settings?.enabled||!all[jev.KEY])throw new Error('Enable JEV and add your API key in X Focus settings.');
    // Persist the attempt before dispatch. If the worker/browser dies, retain an
    // uncertain outcome instead of charging for an automatic duplicate request.
    const body=JSON.stringify(jev.request(post));
    const log={endpoint:'https://api.typesafe.ai/v1/systemone',method:'POST',request:JSON.parse(body),startedAt:Date.now(),status:null,response:null};
    await chrome.storage.local.set({[key]:{log,account:message.account,postId:post.id,contract:jev.VERSION,createdAt:Date.now(),error:'Assessment was started; its result is unavailable. It will not be requested again automatically.'}});
    let saved;
    try{
      const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:'Bearer '+all[jev.KEY],'Content-Type':'application/json'},body,signal:AbortSignal.timeout(30000)});
      log.status=response.status;
      // Never retain authorization headers or a credential echoed by a provider.
      const raw=await response.text();
      log.response=raw.split(all[jev.KEY]).join('[REDACTED]');
      if(!response.ok)throw new Error(response.status===401||response.status===403?'JEV rejected the API key.':response.status===429?'JEV rate limit reached.':'JEV request failed.');
      const result=jev.parse(JSON.parse(raw));
      saved={account:message.account,postId:post.id,contract:jev.VERSION,createdAt:Date.now(),result};
    }catch(error){saved={account:message.account,postId:post.id,contract:jev.VERSION,createdAt:Date.now(),error:error.name==='TimeoutError'?'JEV timed out.':error.message==='JEV returned an invalid assessment.'?error.message:['JEV rejected the API key.','JEV rate limit reached.','JEV request failed.'].includes(error.message)?error.message:'JEV could not assess this post.'};}
    log.finishedAt=Date.now();
    saved.log=log;
    await chrome.storage.local.set({[key]:saved});
    return saved;
  }
  // One request at a time, shared across tabs. Failures are cached too: scrolling
  // or remounting a post must not start another paid request.
  const key=jobKey+'.'+message.action;
  if(!jevJobs.has(key)){
    const task=jevQueue.then(run);jevQueue=task.catch(()=>{});
    jevJobs.set(key,task.finally(()=>jevJobs.delete(key)));
  }
  jevJobs.get(key).then(value=>respond({value}),error=>respond({error:error.message||'Assessment unavailable.'}));
  return true;
});
