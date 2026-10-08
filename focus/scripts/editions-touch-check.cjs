// Run against a dedicated Android Home tab via its forwarded CDP WebSocket URL.
// Uses trusted touch events and real hit testing; never changes saved shortcuts.
const assert = require('node:assert/strict');
const address = process.argv[2];
if (!address) throw new Error('Usage: node scripts/editions-touch-check.cjs ws://127.0.0.1:PORT/devtools/page/TARGET');
const socket = new WebSocket(address);
const pending = new Map();
let sequence = 0, originalScroll, lastTapScroll, ownsDialog = false;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
socket.onmessage = event => {
  const message = JSON.parse(event.data), task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
};
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, {resolve, reject}); socket.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
const footer = `document.querySelector('sifi-edition-ending')`;
const shortcuts = `${footer}?.shadowRoot.querySelector('sifi-shortcuts')?.shadowRoot`;
const editor = `document.querySelector('sifi-shortcut-editor')?.shadowRoot`;
async function touch(expression) {
  await evaluate(`(()=>{const target=(${expression});target.scrollIntoView({block:target.closest('dialog')?'nearest':'center',behavior:'instant'})})()`);
  await wait(1100);
  const point = await evaluate(`(()=>{const r=(${expression}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  lastTapScroll = await evaluate('scrollY');
  await command('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{...point,id:1}]});
  await wait(80);
  await command('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]});
  await wait(250);
}
async function closeEditor() {
  await touch(`${editor}.querySelector('.close')`);
  assert.equal(await evaluate(`${editor}.querySelector('dialog').open`), false);
  ownsDialog = false;
}
const deadline = setTimeout(() => { console.error('Touch check timed out'); process.exit(1); }, 40000);
socket.onopen = async () => {
  try {
    assert.equal(await evaluate('location.pathname'), '/home', 'Use a dedicated X Home tab');
    assert.ok(await evaluate(`!!${shortcuts}?.querySelector('a')`), 'At least one saved shortcut must be rendered');
    assert.equal(await evaluate(`!!${editor}?.querySelector('dialog').open`), false, 'Close any existing shortcut editor first');
    originalScroll = await evaluate('scrollY');
    ownsDialog = true;
    await touch(`${shortcuts}.querySelector('.card-heading button')`);
    assert.equal(await evaluate(`!!${editor}?.querySelector('dialog').open`), true, 'Real touch must open the footer manager');
    const readingPosition=lastTapScroll;
    await wait(700);
    assert.ok(Math.abs(await evaluate('scrollY')-readingPosition)<2, 'Opening the editor must preserve the feed scroll position');
    await touch(`${editor}.querySelector('.row button')`);
    assert.ok(await evaluate(`!!${editor}.querySelector('[name=url]')`), 'Edit must open the saved destination form');
    await closeEditor();
    assert.ok(Math.abs(await evaluate('scrollY')-readingPosition)<2, 'Closing the editor must preserve the feed scroll position');
    ownsDialog = true;
    await touch(`${shortcuts}.querySelector('.card-heading button')`);
    assert.equal(await evaluate(`!!${editor}?.querySelector('dialog').open`), true, 'The footer manager must reopen after editing');
    await touch(`${editor}.querySelector('.wide')`);
    assert.equal(await evaluate(`${editor}.querySelector('[name=url]').value`), '', 'Add must open an empty form');
    await closeEditor();
    await evaluate(`(()=>{
      const link=${shortcuts}.querySelector('a');
      const check=window.__sifiFooterTouchCheck={link,activated:false};
      check.handler=event=>{event.preventDefault();check.activated=event.isTrusted&&event.currentTarget===link};
      link.addEventListener('click',check.handler,{once:true,capture:true});
    })()`);
    await touch(`${shortcuts}.querySelector('a')`);
    assert.equal(await evaluate('window.__sifiFooterTouchCheck.activated'), true, 'The visible card must receive trusted touch activation');
    assert.equal(await evaluate(`(()=>{
      const bar=document.querySelector('[data-testid=BottomBar]'); if(!bar)return true;
      const r=bar.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return hit===bar||bar.contains(hit);
    })()`), true, 'The footer must remain below the native toolbar');
    console.log('Trusted Android touch: footer manager, Edit, Add, card activation, preserved feed position and native toolbar layering passed. No settings changed.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally {
    try {
      await evaluate(`(()=>{const check=window.__sifiFooterTouchCheck;if(check){check.link.removeEventListener('click',check.handler,true);delete window.__sifiFooterTouchCheck;}})()`);
      if (ownsDialog) await evaluate(`${editor}?.querySelector('dialog').close()`);
      if (originalScroll !== undefined) await evaluate(`scrollTo({top:${originalScroll},behavior:'instant'})`);
    } catch {}
    clearTimeout(deadline); socket.close();
  }
};
socket.onerror = () => { clearTimeout(deadline); console.error('Could not connect to the target tab'); process.exitCode = 1; };
