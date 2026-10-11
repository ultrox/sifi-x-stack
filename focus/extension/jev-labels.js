(() => {
  const jev=SifiJev;
  let enabled=false,posts=new Set(),account=null,scheduled=false;
  const results=new Map(),pending=new Set();
  const attached=new WeakMap();
  let observer, controls, running=false, notice="", completed=0, total=0, redoing=false;
  let refreshId=0;
  function accountId(){try{return decodeURIComponent(document.cookie.match(/(?:^|;\s*)twid=([^;]+)/)?.[1]||'').match(/^u=(\d+)$/)?.[1]||null;}catch{return null;}}
  async function refresh(){
    const revision=++refreshId;
    const owner=accountId();
    if(owner!==account){account=owner;results.clear();pending.clear();}
    const values=await chrome.storage.local.get([jev.SETTINGS,'sifi.focus.settings','sifi.edition.'+owner+'.for-you']);
    if(owner!==accountId()||revision!==refreshId)return;
    enabled=!!values[jev.SETTINGS]?.enabled;
    const record=values['sifi.edition.'+owner+'.for-you'];
    // The background validates the authoritative stored edition before calling
    // JEV. This list merely limits which visible cards receive a label.
    posts=new Set(jev.posts(record,Math.max(1,Math.min(18,values['sifi.focus.settings']?.forYouLimit||18))).map(p=>p.id));
    const ids=[...posts];
    const cached=await chrome.storage.local.get(ids.map(id=>jev.CACHE+owner+'.'+id));
    if(owner!==accountId()||revision!==refreshId)return;
    for(const id of ids){const value=cached[jev.CACHE+owner+'.'+id];if(value)results.set(id,value);}
    schedule();
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}
  function render(){
    const tabs=[...document.querySelectorAll('[role="tablist"] [role="tab"]')];
    const forYou=/^\/home\/?$/.test(location.pathname)&&tabs[0]?.getAttribute('aria-selected')==='true';
    renderControls(forYou);
    for(const article of document.querySelectorAll('article[data-testid="tweet"]')){
      const timeLink=article.querySelector('a[href*="/status/"] time')?.closest('a');
      const id=timeLink?.getAttribute('href')?.match(/\/status\/(\d+)/)?.[1];
      const prior=attached.get(article);
      if(!enabled||!forYou||!posts.has(id)||(!results.has(id)&&!pending.has(id))) {if(prior){prior.host.remove();attached.delete(article);}continue;}
      if(prior?.id===id&&prior.host.isConnected)continue;
      prior?.host.remove();
      const host=document.createElement('sifi-jev-label');
      const shadow=host.attachShadow({mode:'open'});
      // No HTML from a post or provider response is inserted into the label.
      const style=document.createElement('style');style.textContent=`
        :host{display:block;width:100%;max-width:100%;box-sizing:border-box;flex:0 0 auto;min-width:0;align-self:stretch;margin:10px 0;color:inherit;font:13px/1.45 system-ui;--bg:#f5f5f5;--ink:#27313a;--line:#d5d9dc}
        :host([dark]){--bg:#202327;--ink:#e7e9ea;--line:#48515a}
        :host([tone=warning]){--bg:#fff1e5;--ink:#8c3600;--line:#f27a3a}
        :host([tone=warning][dark]){--bg:#35241b;--ink:#ffbd8d;--line:#f27a3a}
        :host([tone=context]){--bg:#edf4fa;--ink:#285578;--line:#7398b7}
        :host([tone=context][dark]){--bg:#1b2b38;--ink:#b5d4ec;--line:#7398b7}
        *{box-sizing:border-box}button{font:inherit;color:inherit;background:transparent;border:1px solid #80808066;border-radius:18px;min-height:40px;padding:7px 12px;cursor:pointer}
        .summary{display:flex;align-items:center;gap:10px;width:100%;min-height:46px;padding:10px 12px;border:1px solid var(--line);border-left-width:4px;border-radius:10px;background:var(--bg);color:var(--ink);text-align:left}
        :host([tone=neutral]) .summary{background:transparent;border-color:var(--line);border-left-width:1px}:host([tone=neutral]) .title{font-size:13px;font-weight:500}
        :host([confidence=low]) .symbol{color:#925700;background:#fff3db}:host([confidence=medium]) .symbol{color:#17649d;background:#e8f3ff}:host([confidence=high]) .symbol{color:#7345a2;background:#f2eaff}
        :host([dark][confidence=low]) .symbol{color:#ffd28a;background:#382c1c}:host([dark][confidence=medium]) .symbol{color:#92ceff;background:#192d40}:host([dark][confidence=high]) .symbol{color:#d6b2ff;background:#30213f}
        .symbol{display:grid;place-items:center;flex:0 0 22px;height:22px;border:1.5px solid currentColor;border-radius:50%;font-weight:800}
        .title{font-weight:700;font-size:14px;flex:1;min-width:0}.category{font-size:13px;white-space:nowrap;margin-left:auto;opacity:.85}.chevron{font-size:16px}
        .details{margin-top:6px;padding:12px;border:1px solid var(--line);border-radius:10px}.details[hidden], [hidden]{display:none!important}.tabs{display:flex;gap:6px;margin-bottom:12px}.tabs button{border:0;border-radius:6px;min-height:36px}.tabs button[aria-selected=true]{background:var(--bg);font-weight:700}.log pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:280px;overflow:auto;background:var(--bg);padding:10px;border-radius:6px;font:11px/1.5 ui-monospace,monospace}.log h4{margin:12px 0 6px}.log{min-width:0}p{margin:0 0 8px}.muted{opacity:.72;font-size:12px}.choices{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
        button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
      `;
      const summary=document.createElement('button');summary.className='summary';summary.type='button';summary.setAttribute('aria-expanded','false');
      const symbol=document.createElement('span');symbol.className='symbol';symbol.setAttribute('aria-hidden','true');symbol.textContent='…';
      const title=document.createElement('span');title.className='title';title.textContent='Assessing post…';
      const category=document.createElement('span');category.className='category';category.textContent='JEV';
      const chevron=document.createElement('span');chevron.className='chevron';chevron.textContent='⌄';chevron.setAttribute('aria-hidden','true');summary.append(symbol,title,category,chevron);
      const details=document.createElement('div');details.className='details';details.hidden=true;
      summary.onclick=()=>{details.hidden=!details.hidden;summary.setAttribute('aria-expanded',String(!details.hidden));};
      host.addEventListener('click',e=>e.stopPropagation());shadow.append(style,summary,details);
      const anchor=labelAnchor(article);
      if(!anchor)continue;
      anchor.before(host);
      attached.set(article,{id,host,summary,details,symbol,title,category});
      paint(article,id);

    }
  }
  function labelAnchor(article){
    let anchor=article.querySelector('[data-testid="tweetText"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"]');
    const name=article.querySelector('[data-testid="User-Name"]');
    if(anchor&&name){
      let column=anchor.parentElement;
      while(column&&column!==article&&!column.contains(name))column=column.parentElement;
      if(column&&column!==article)while(anchor.parentElement!==column)anchor=anchor.parentElement;
    }
    return anchor||article.querySelector('[role="group"]');
  }
  function renderControls(forYou){
    const region=document.querySelector('[data-testid="primaryColumn"] section[role="region"]');
    if(!forYou||!region){controls?.host.remove();return;}
    if(!controls){
      const host=document.createElement('sifi-jev-controls'),shadow=host.attachShadow({mode:'open'});
      const style=document.createElement('style');style.textContent=':host{display:block;color:inherit;font:13px/1.4 system-ui;padding:12px 16px;border-bottom:1px solid #80808040}.row{display:flex;align-items:center;gap:12px;justify-content:space-between}strong{font-size:13px}button{min-height:40px;border:1px solid #80808066;border-radius:22px;padding:8px 14px;color:inherit;background:transparent;font:600 13px system-ui;cursor:pointer}button:disabled{opacity:.55;cursor:default}p{margin:6px 0 0;opacity:.72;font-size:12px}';
      const row=document.createElement('div');row.className='row';const title=document.createElement('strong');title.textContent='JEV · Post quality';
      const button=document.createElement('button');button.type='button';button.onclick=runClassification;
      const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
      row.append(title,button);shadow.append(style,row,status);controls={host,button,status};
    }
    if(!controls.host.isConnected){const heading=region.previousElementSibling; (heading?.tagName.toLowerCase()==='sifi-edition-heading'?heading:region).before(controls.host);}
    const ids=[...posts],remaining=ids.filter(id=>!results.has(id)&&!pending.has(id)).length;
    const cached=ids.filter(id=>results.has(id)).length;
    const failed=ids.filter(id=>results.get(id)?.error).length;
    controls.button.disabled=running||!enabled||!ids.length;
    controls.button.textContent=running?(redoing?'Reassessing…':'Classifying…'):remaining||!ids.length?'Classify posts':'Reassess posts';
    const status=!enabled?'Enable JEV and add your key in X Focus settings.':!ids.length?'Open a saved For you edition to classify posts.':running?`${completed} of ${total} finished · ${redoing?'Replacing saved assessments.':'Saved results are reused.'}`:notice||`${cached-failed} cached · ${failed?failed+' unavailable · ':''}${remaining} not assessed. ${remaining?'Runs only when you click.':'Reassess replaces these with fresh JEV results.'}`;
    if(controls.status.textContent!==status)controls.status.textContent=status;
  }
  async function runClassification(){
    if(running||!enabled)return;
    const owner=account;
    redoing=posts.size>0&&[...posts].every(id=>results.has(id));
    const ids=[...posts].filter(id=>redoing||!results.has(id));
    completed=0;total=ids.length;running=true;notice='';schedule();
    try{
      for(const id of ids){
        if(owner!==account||!enabled)break;
        if((!redoing&&results.has(id))||!posts.has(id))continue;
        pending.add(id);schedule();
        try{
          const response=await chrome.runtime.sendMessage({type:'sifi-jev',action:redoing?'reassess':'assess',account:owner,postId:id});
          if(owner!==account)break;
          if(response.error){notice=response.error;break;}
          results.set(id,response.value||{error:'Assessment unavailable.'});completed++;
        }catch{notice='Connection interrupted. Saved attempts will not be repeated.';break;}
        finally{pending.delete(id);for(const article of document.querySelectorAll('article[data-testid="tweet"]'))paint(article,id);schedule();}
      }
    }finally{running=false;schedule();}
  }
  function paint(article,id){
    const ui=attached.get(article);if(!ui||ui.id!==id)return;
    const saved=results.get(id);if(!saved)return;
    ui.details.replaceChildren();
    const tabs=document.createElement('div');tabs.className='tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Assessment details');
    const explanation=document.createElement('div'),logPanel=document.createElement('div');logPanel.className='log';
    ui.details.append(tabs,explanation,logPanel);
    for(const [name,panel] of [['Assessment',explanation],['Log',logPanel]]){
      const button=document.createElement('button');button.type='button';button.textContent=name;button.setAttribute('role','tab');
      panel.setAttribute('role','tabpanel');panel.setAttribute('aria-label',name);
      const selected=(ui.tab||'Assessment')===name;button.setAttribute('aria-selected',String(selected));panel.hidden=!selected;tabs.append(button);
      button.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();ui.tab=e.key==='Home'?'Assessment':e.key==='End'?'Log':name==='Log'?'Assessment':'Log';paint(article,id);ui.details.querySelector('[aria-selected="true"]').focus();}};
      button.tabIndex=selected?0:-1;
      button.onclick=()=>{ui.tab=name;paint(article,id);ui.details.querySelector('[aria-selected="true"]').focus();};
    }
    function logText(text){const p=document.createElement('p');p.textContent=text;logPanel.append(p);}
    function logBlock(title,value){const h=document.createElement('h4');h.textContent=title;const pre=document.createElement('pre');pre.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);logPanel.append(h,pre);}
    if(saved.log){
      logText('Stored exchange · '+new Date(saved.log.startedAt).toLocaleString()+'. Authorization headers are never saved.');
      logText(saved.log.method+' '+saved.log.endpoint);
      logBlock('Sent · request JSON',saved.log.request);
      logText(saved.log.status===null?'No HTTP response recorded.':'Received · HTTP '+saved.log.status);
      let response=saved.log.response;
      if(response!==null){try{response=JSON.parse(response);}catch{} logBlock('Received · response body',response);}
      else logText('No response body was saved. This attempt will not be repeated.');
    }else logText('This assessment was cached before exchange logging was added. Its original request and response were not saved. No new JEV call will be made.');
    if(saved.result)logBlock('Saved assessment · after local rules',saved.result);
    if(saved.correction)logText('Your local correction: '+saved.correction+' (not sent to JEV).');
    function paragraph(text,cls=''){const p=document.createElement('p');p.textContent=text;p.className=cls;explanation.append(p);}

    const display=jev.presentation(saved);
    ui.host.setAttribute('tone',display.tone);
    ui.host.setAttribute('confidence',display.confidence);
    ui.summary.title=display.description;
    ui.summary.setAttribute('aria-label','JEV · '+display.category+'. '+display.description);
    const rgb=getComputedStyle(article).color.match(/\d+/g)||['0'];
    ui.host.toggleAttribute('dark',rgb.slice(0,3).reduce((sum,n)=>sum+Number(n),0)/3>150);
    ui.title.textContent=display.title;ui.title.hidden=!display.title;ui.symbol.textContent=display.symbol;ui.category.textContent='JEV · '+display.category;
    if(saved.error){paragraph(saved.error);return;}
    for(const text of jev.explanation(saved))paragraph(text);
    const wrong=document.createElement('button');wrong.type='button';wrong.textContent='Wrong assessment';explanation.append(wrong);
    wrong.onclick=()=>{
      wrong.disabled=true;const choices=document.createElement('div');choices.className='choices';explanation.append(choices);
      for(const [value,label]of Object.entries(jev.labels.verdict)){
        const button=document.createElement('button');button.type='button';button.textContent=label;choices.append(button);
        button.onclick=async()=>{
          for(const b of choices.children)b.disabled=true;
          try{const response=await chrome.runtime.sendMessage({type:'sifi-jev',action:'correct',account,postId:id,verdict:value});if(response.error)throw new Error(response.error);results.set(id,response.value);paint(article,id);}
          catch{paragraph('Could not save your correction. Try again.');for(const b of choices.children)b.disabled=false;}
        };
      }
    };
  }
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area!=='local')return;
    for(const [key,change]of Object.entries(changes))if(key.startsWith(jev.CACHE)&&change.newValue?.account===account&&(change.newValue.result||change.newValue.error)){results.set(change.newValue.postId,change.newValue);for(const article of document.querySelectorAll('article[data-testid="tweet"]'))paint(article,change.newValue.postId);}
    schedule();
    if(changes[jev.SETTINGS]||changes['sifi.focus.settings']||Object.keys(changes).some(k=>k.startsWith('sifi.edition.')))refresh();
  });
  function start(){
    refresh();
    const root=document.querySelector('main')||document.body;
    observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-selected']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.addEventListener('popstate',()=>{refresh();schedule();});
})();
