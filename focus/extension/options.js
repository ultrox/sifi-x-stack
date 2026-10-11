(() => {
  const key='sifi.focus.settings';
  const form=document.querySelector('form'),input=document.querySelector('#post-limit');
  const button=form.querySelector('button'),status=document.querySelector('#status');
  async function load(){
    try { const values=await chrome.storage.local.get(key);input.value=SifiEditions.settings(values[key]).forYouLimit;input.disabled=button.disabled=false;status.textContent=''; }
    catch {status.textContent='Could not load settings. Reopen this panel to retry.';}
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    input.disabled=button.disabled=true;
    try {
      const previous=(await chrome.storage.local.get(key))[key]||{};
      await chrome.storage.local.set({[key]:{...previous,...SifiEditions.settings({forYouLimit:Number(input.value)})}});
      status.textContent='Saved. Reload X to apply.';
    } catch {status.textContent='Could not save. Please try again.';}
    finally {input.disabled=button.disabled=false;}
  });
  const enabled=document.querySelector('#jev-enabled'),apiKey=document.querySelector('#jev-key'),saveJev=document.querySelector('#save-jev'),jevStatus=document.querySelector('#jev-status'),keyState=document.querySelector('#key-state');
  let hasKey=false;
  chrome.storage.local.get([SifiJev.SETTINGS,SifiJev.KEY]).then(values=>{
    const saved=values[SifiJev.SETTINGS]||{};enabled.checked=!!saved.enabled;hasKey=!!values[SifiJev.KEY];
    keyState.textContent=hasKey?'Key saved. Leave blank to keep it.':'No key saved.';
    enabled.disabled=apiKey.disabled=saveJev.disabled=false;
  }).catch(()=>{jevStatus.textContent='Could not load JEV settings.';});
  saveJev.onclick=async()=>{
    if(enabled.checked&&!hasKey&&!apiKey.value.trim()){jevStatus.textContent='Add your TypeSafe API key first.';return;}
    saveJev.disabled=true;
    try{
      const old=(await chrome.storage.local.get(SifiJev.KEY))[SifiJev.KEY]||'';
      const value=apiKey.value.trim()||old||'';
      await chrome.storage.local.set({[SifiJev.SETTINGS]:{enabled:enabled.checked},[SifiJev.KEY]:value});
      hasKey=!!value;apiKey.value='';keyState.textContent=hasKey?'Key saved. Leave blank to keep it.':'No key saved.';
      jevStatus.textContent='Saved. Assessments stay cached; corrections do not call JEV.';
    }catch{jevStatus.textContent='Could not save JEV settings.';}finally{saveJev.disabled=false;}
  };
  load();
})();
