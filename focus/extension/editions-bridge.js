(() => {
  function accountId() {
    const raw = document.cookie.match(/(?:^|;\s*)twid=([^;]+)/)?.[1];
    try { return decodeURIComponent(raw || '').match(/^u=(\d+)$/)?.[1]; } catch { return null; }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const change of Object.values(changes)) {
      const record = change.newValue;
      if (record?.account === accountId() && record.schema === 1) window.postMessage({type:'sifi-edition-cache-update',record},location.origin);
    }
  });
  window.addEventListener('message', async event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin || message?.type !== 'sifi-edition-request') return;
    if (typeof message.id !== 'string' || message.account !== accountId()) return;
    if (!['get','put','react'].includes(message.action) || !['following','for-you'].includes(message.feed)) return;
    let result;
    try {
      result = await chrome.runtime.sendMessage({...message, type:'sifi-edition-store'});
      if (message.account !== accountId()) throw new Error('Account changed');
    } catch { result = {error:'Edition storage is unavailable. Reload to reconnect.'}; }
    window.postMessage({type:'sifi-edition-response', id:message.id, ...result}, location.origin);
  });
})();
