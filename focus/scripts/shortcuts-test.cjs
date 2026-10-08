const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../extension/shortcuts-core.js');
const shortcut = (id, title = 'Read something') => ({id, title, url: 'example.com/read', icon: '📚', description: 'A deliberate destination.'});
assert.equal(core.url('example.com/a?b=1'), 'https://example.com/a?b=1');
for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test', 'https://user:password@example.com', 'https://']) {
  assert.throws(() => core.url(url));
}
assert.equal(core.destination(core.GMAIL), core.GMAIL);
assert.equal(core.item({...shortcut('mochi'),url:core.MOCHI}).url,core.MOCHI);
assert.equal(core.destinationLabel(core.MOCHI),'cards.mochi.app');
for(const old of [
 'intent://label/INBOX#Intent;scheme=gmail;package=com.google.android.gm;end',
 'intent://mail.google.com/mail/u/0/#Intent;scheme=https;package=com.google.android.gm;end',
]) {
 const saved={...shortcut('gmail'),url:old};
 const upgraded=core.read({items:[saved]})[0];
 assert.equal(upgraded.url,core.GMAIL,'Existing Gmail presets use the cold-start entry point');
 assert.equal(upgraded.title,saved.title);assert.equal(upgraded.icon,saved.icon);
 assert.equal(saved.url,old,'Migration does not mutate the source record');
}
const otherLabel='intent://label/OTHER#Intent;scheme=gmail;package=com.google.android.gm;end';
assert.equal(core.destination(otherLabel),otherLabel,'User-supplied label links remain untouched');
assert.equal(core.item({...shortcut('gmail'),url:core.GMAIL}).url,core.GMAIL);
assert.equal(core.destinationLabel(core.GMAIL),'com.google.android.gm');
assert.throws(() => core.image(core.GMAIL), 'Image sources remain HTTP(S) or local image data');
for(const bad of [
  'intent://x#Intent;scheme=javascript;package=com.example.app;end',
  'intent://x#Intent;scheme=https;package=com.example.app;action=com.example.SEND;end',
  'intent://x#Intent;scheme=https;package=com.example.app;component=com.example.app/Activity;end',
  'intent://x#Intent;scheme=https;package=com.example.app;S.browser_fallback_url=javascript%3Aalert(1);end',
  'intent://x#Intent;scheme=https;end',
  'intent://x#Intent;scheme=https;package=com.example.app;scheme=javascript;end',
]) assert.throws(()=>core.destination(bad));
assert.equal(core.destination('example.com'),'https://example.com/');
assert.throws(() => core.image('data:image/svg+xml;base64,PHN2Zz4='));
assert.throws(() => core.image('data:image/png;base64,' + 'A'.repeat(220000)));
assert.equal(core.item({...shortcut('1'), iconImage:'data:image/png;base64,AAAA'}).iconImage, 'data:image/png;base64,AAAA');
assert.throws(() => core.item({...shortcut('1'), title: ''}));
assert.equal(core.read({items:[shortcut('1'), shortcut('1'), {id:'bad'}]}).length, 1);
let full = {items: Array.from({length:20}, (_, i) => shortcut(String(i)))};
assert.throws(() => core.change(full, {action:'save', item:shortcut('21')}));
assert.equal(core.change(full, {action:'save', item:shortcut('1','Updated')}).items.length, 20);
assert.equal(core.change(full, {action:'remove', id:'1'}).items.length, 19);

// Run the real combined service worker, with a durable fake chrome.storage.
const data = {};
let listeners;
function startWorker() {
  listeners = [];
  const chrome = {runtime:{id:'fixture',onMessage:{addListener:fn => listeners.push(fn)}},storage:{local:{
    get:async key => key===null ? structuredClone(data) : {[key]:structuredClone(data[key])},
    set:async values => Object.assign(data,structuredClone(values)),
    remove:async keys => keys.forEach(key => delete data[key])
  }}};
  const context = vm.createContext({chrome, URL});
  context.importScripts = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(`extension/${file}`, 'utf8'), context));
  context.importScripts('editions-store.js');
}
const sender = {id:'fixture',url:'https://x.com/home'};
const send = message => new Promise(resolve => {
  for (const listener of listeners) if (listener(message,sender,resolve)) return;
  throw new Error('No handler');
});
(async () => {
  startWorker();
  await Promise.all(['a','b','c'].map(id => send({type:'sifi-shortcut-change',action:'save',item:shortcut(id)})));
  assert.deepEqual(data[core.KEY].items.map(i => i.id), ['a','b','c'], 'Concurrent tabs retain all additions');
  startWorker();
  await send({type:'sifi-shortcut-change',action:'save',item:shortcut('b','Edited after restart')});
  assert.equal(data[core.KEY].items[1].title, 'Edited after restart');
  assert.equal(data[core.KEY].items.length, 3, 'Editing after worker restart retains other entries');
  const record = account => ({schema:1,account,feed:'following',edition:'10',capturedAt:1234,nextAt:9999,count:0,payload:{data:{home:{home_timeline_urt:{instructions:[]}}}}});
  for (const account of ['123','456']) await send({type:'sifi-edition-store',action:'put',account,feed:'following',record:record(account)});
  assert.equal(data[core.KEY].items.length, 3, 'Edition account cleanup preserves shortcuts');
  await send({type:'sifi-shortcut-change',action:'remove',id:'a'});
  assert.deepEqual(data[core.KEY].items.map(i => i.id), ['b','c']);
  assert.ok((await send({type:'sifi-shortcut-change',action:'save',item:{...shortcut('x'),url:'javascript:alert(1)'}})).error);
  let replied = false;
  for (const listener of listeners) assert.equal(listener({type:'sifi-shortcut-change',action:'remove',id:'b'},{id:'fixture',url:'https://unrelated.test'},()=>replied=true),undefined);
  assert.equal(replied,false);
  console.log('Shortcut URL/image validation, limits, concurrent edits, restart persistence, account cleanup and sender validation passed.');
})().catch(error => { console.error(error); process.exitCode=1; });
