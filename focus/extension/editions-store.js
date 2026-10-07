importScripts('editions-core.js');
const core = globalThis.SifiEditions;
const PREFIX = 'sifi.edition.';
let writes = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'sifi-edition-store' || sender.id !== chrome.runtime.id) return;
  let origin;
  try { origin = new URL(sender.url).hostname; } catch { return; }
  if (!/^(?:www\.|mobile\.)?(?:x|twitter)\.com$/.test(origin)) return;
  const {action, account, feed} = message;
  if (!/^\d{1,25}$/.test(account) || !['following','for-you'].includes(feed)) return;
  const key = `${PREFIX}${account}.${feed}`;
  async function run() {
    if (action === 'get') {
      const result = (await chrome.storage.local.get(key))[key];
      return core.valid(result, account, feed) ? result : null;
    }
    if (action === 'react') {
      const all = await chrome.storage.local.get(null);
      const updates = {};
      for (const [name,value] of Object.entries(all)) {
        if (name.startsWith(`${PREFIX}${account}.`) && core.valid(value,account,value.feed)) updates[name] = core.applyReaction(value,message.record);
      }
      if (Object.keys(updates).length) await chrome.storage.local.set(updates);
      return updates[key] || null;
    }
    if (action !== 'put' || !core.valid(message.record, account, feed)) throw new Error('Invalid edition');
    if (JSON.stringify(message.record).length > 3_000_000) throw new Error('Edition is too large to save');
    const previous = (await chrome.storage.local.get(key))[key];
    // The first completed capture wins, including concurrent tabs on other X origins.
    if (core.valid(previous, account, feed) && Number(previous.edition) >= Number(message.record.edition)) return previous;
    await chrome.storage.local.set({[key]:message.record});
    // Only the current account's two latest feeds are retained. No history yet.
    const all = await chrome.storage.local.get(null);
    const stale = Object.keys(all).filter(k => k.startsWith(PREFIX) && !k.startsWith(`${PREFIX}${account}.`));
    if (stale.length) await chrome.storage.local.remove(stale);
    return message.record;
  }
  const task = writes.then(run);
  writes = task.catch(() => {});
  task.then(record => respond({record}), () => respond({error:'Could not save the edition on this device.'}));
  return true;
});
