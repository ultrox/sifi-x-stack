/* Shared validation for locally saved destinations. */
((root,factory)=>{
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SifiShortcuts=factory();
})(globalThis,()=>{
  const KEY='sifi.shortcuts.v1';
  const LIMIT=20;
  function url(value,optional=false){
    const text=String(value||'').trim();
    if(!text&&optional)return '';
    if(!text)throw new Error('Enter a website address.');
    let parsed;
    try{parsed=new URL(/^[a-z][a-z\d+.-]*:/i.test(text)?text:`https://${text}`);}catch{throw new Error('Enter a valid website address.');}
    if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('Use an http or https address without a username or password.');
    if(parsed.href.length>2048)throw new Error('That address is too long.');
    return parsed.href;
  }
  const GMAIL='intent://gmail.app.goo.gl/#Intent;scheme=https;package=com.google.android.gm;end';
  const MOCHI='intent://#Intent;scheme=mochi;package=cards.mochi.app;end';
  const OLD_GMAIL_LINKS=new Set([
    'intent://label/INBOX#Intent;scheme=gmail;package=com.google.android.gm;end',
    'intent://mail.google.com/mail/u/0/#Intent;scheme=https;package=com.google.android.gm;end',
  ]);
  function destination(value){
    const text=String(value||'').trim();
    // Repair earlier presets when loading existing shortcuts, retaining all other settings.
    if(OLD_GMAIL_LINKS.has(text))return GMAIL;
    if(!text.startsWith('intent:'))return url(text);
    if(text.length>4096||/[\s\x00-\x1f]/.test(text))throw new Error('Enter a valid Android app link.');
    const match=text.match(/^intent:\/\/(.*?)#Intent;(.+);end$/);
    if(!match)throw new Error('Use a complete Android intent link.');
    const fields=new Map();
    for(const part of match[2].split(';')){
      const separator=part.indexOf('=');
      if(separator<1)throw new Error('Invalid Android app link.');
      const key=part.slice(0,separator), value=part.slice(separator+1);
      if(!['scheme','package','action','category','S.browser_fallback_url'].includes(key)||fields.has(key))throw new Error('Use an app-opening intent without extra commands.');
      fields.set(key,value);
    }
    const scheme=fields.get('scheme')||'';
    if(!/^[a-z][a-z0-9+.-]*$/.test(scheme)||['javascript','data','file','content','blob','filesystem','about','chrome','chrome-extension','devtools','intent','view-source'].includes(scheme))throw new Error('Use a website or app scheme.');
    if(!/^[a-zA-Z]\w*(?:\.[a-zA-Z]\w*)+$/.test(fields.get('package')||''))throw new Error('The app link needs an Android package name.');
    if(fields.has('action')&&!['android.intent.action.VIEW','android.intent.action.MAIN'].includes(fields.get('action')))throw new Error('Shortcuts can open apps, not run other app actions.');
    if(fields.has('category')&&!['android.intent.category.BROWSABLE','android.intent.category.LAUNCHER'].includes(fields.get('category')))throw new Error('Unsupported app-link category.');
    if(fields.has('S.browser_fallback_url')){
      try{url(decodeURIComponent(fields.get('S.browser_fallback_url')));}catch{throw new Error('The fallback must be a website address.');}
    }
    return text;
  }
  function destinationLabel(value){
    return value.startsWith('intent:') ? (value.match(/;package=([^;]+)/)?.[1]||'Android app') : new URL(value).hostname;
  }
  function image(value){
    if(!value)return '';
    if(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)){
      if(value.length>220000)throw new Error('Choose a smaller image.');
      return value;
    }
    return url(value,true);
  }
  function item(value){
    if(!value||typeof value!=='object')throw new Error('Invalid shortcut.');
    const title=String(value.title||'').trim();
    if(!title||title.length>60)throw new Error('Give the shortcut a title, up to 60 characters.');
    const id=String(value.id||'');
    if(!/^[a-zA-Z0-9-]{1,64}$/.test(id))throw new Error('Invalid shortcut identifier.');
    const icon=String(value.icon||'↗').trim()||'↗';
    if(icon.length>32)throw new Error('Use a short symbol or emoji for the icon.');
    const description=String(value.description||'').trim();
    if(description.length>180)throw new Error('Keep the description under 180 characters.');
    return {id,title,url:destination(value.url),icon,iconImage:image(value.iconImage),poster:image(value.poster),description};
  }
  function read(value){
    const items=[];const ids=new Set();
    for(const entry of Array.isArray(value?.items)?value.items:[]){
      try{const clean=item(entry);if(!ids.has(clean.id)&&items.length<LIMIT){items.push(clean);ids.add(clean.id);}}catch{}
    }
    return items;
  }
  function change(value,operation){
    const items=read(value);
    if(operation.action==='remove')return {version:1,items:items.filter(entry=>entry.id!==operation.id)};
    if(operation.action!=='save')throw new Error('Unknown shortcut action.');
    const clean=item(operation.item);
    const index=items.findIndex(entry=>entry.id===clean.id);
    if(index>=0)items[index]=clean;
    else{if(items.length>=LIMIT)throw new Error(`You can save up to ${LIMIT} shortcuts.`);items.push(clean);}
    const result={version:1,items};
    if(JSON.stringify(result).length>4000000)throw new Error('Your shortcut images are taking too much space. Remove an image and try again.');
    return result;
  }
  return {KEY,LIMIT,GMAIL,MOCHI,url,destination,destinationLabel,image,item,read,change};
});
