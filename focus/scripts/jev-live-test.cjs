// Explicit opt-in provider smoke test using fictional posts. Never prints the key.
const fs=require('node:fs'),path=require('node:path');
const core=require('../extension/jev-core.js');
(async()=>{
 const envFile=path.resolve(__dirname,'../../.dev.vars');
 const line=fs.readFileSync(envFile,'utf8').split(/\r?\n/).find(s=>/^\s*TYPESAFE_API_KEY\s*=/.test(s));
 const key=line?.slice(line.indexOf('=')+1).trim().replace(/^(['"])(.*)\1$/,'$2');
 if(!key)throw new Error('TYPESAFE_API_KEY is missing');
 const dest=path.resolve(__dirname,'../dist/jev-fixture-results.json');fs.mkdirSync(path.dirname(dest),{recursive:true});
 const cached=fs.existsSync(dest)?JSON.parse(fs.readFileSync(dest,'utf8')):{};
 const fixtures={tech:'Fictional tech bulletin: the Pine database released version 4 today, adding incremental backups. The release notes report a 20% improvement in restore time on their published test dataset.',bait:'EVERYTHING you know about AI is WRONG. You are already too late. Like and reply YES and I will reveal the one secret nobody wants you to know.',fun:'My code passed every test. Unfortunately, the tests were also written by me.'};
 for(const [name,text]of Object.entries(fixtures)){
   const id=core.VERSION+'.'+name;
   if(!cached[id]){
     cached[id]={status:'attempted'};fs.writeFileSync(dest,JSON.stringify(cached,null,2));
     const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(core.request({text,quote:'',media:[]})),signal:AbortSignal.timeout(30000)});
     if(!response.ok)throw new Error('Provider test failed with HTTP '+response.status);
     cached[id]={status:'complete',result:core.parse(await response.json())};fs.writeFileSync(dest,JSON.stringify(cached,null,2));
   }
   console.log(name+': '+JSON.stringify(cached[id]));
 }
})().catch(e=>{console.error(['TimeoutError','AbortError'].includes(e.name)?'Provider test timed out':e.message);process.exitCode=1});
