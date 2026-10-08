// Serialize settings changes so separate tabs cannot overwrite each other's edits.
importScripts('shortcuts-core.js');
const shortcuts=globalThis.SifiShortcuts;
let shortcutWrites=Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='sifi-shortcut-change'||sender.id!==chrome.runtime.id)return;
  try{if(!/^(?:www\.|mobile\.)?(?:x|twitter)\.com$/.test(new URL(sender.url).hostname))return;}catch{return;}
  const task=shortcutWrites.then(async()=>{
    const current=(await chrome.storage.local.get(shortcuts.KEY))[shortcuts.KEY];
    const result=shortcuts.change(current,message);
    await chrome.storage.local.set({[shortcuts.KEY]:result});
    return result;
  });
  shortcutWrites=task.catch(()=>{});
  task.then(value=>respond({value}),error=>respond({error:error.message||'Could not save your shortcut.'}));
  return true;
});
