(() => {
  const core = window.SifiEditions;
  const nativeFetch = window.fetch.bind(window);
  const pendingMessages = new Map();
  const records = new Map();
  const jobs = new Map();
  let visit = core.windowAt();
  let wasHome = /^\/home\/?$/.test(location.pathname);
  let account = accountId();
  let header = null;
  let ending = null;
  let toolbarObserver = null;
  let toolbar = null;
  let renderKey = '';
  let problem = '';
  let endObserver = null;
  let approachObserver = null;
  let endListObserver = null;
  let endCell = null;
  let displayedEdition = '';
  let enteredAt = Date.now();
  let refreshing = false;
  const attempted = new Set();

  function accountId() {
    const raw = document.cookie.match(/(?:^|;\s*)twid=([^;]+)/)?.[1];
    try { return decodeURIComponent(raw || '').match(/^u=(\d+)$/)?.[1]; } catch { return null; }
  }
  function syncVisit() {
    const path = location.pathname;
    if (!/^\/home\/?$/.test(path)) window.SifiEditionRefresh?.setEnabled(false);
    const transient = /^\/compose\//.test(path) || /\/(?:mediaViewer|video\/\d+)\/?$/.test(path);
    const home = /^\/home\/?$/.test(path) || (wasHome && transient);
    const nextAccount = accountId();
    if (nextAccount !== account) { account = nextAccount; records.clear(); visit = core.windowAt(); }
    if (home && !wasHome) { visit = core.windowAt(); enteredAt = Date.now(); problem = ''; }
    wasHome = home;
  }
  window.addEventListener('message', event => {
    const message = event.data;
    if (event.source !== window || event.origin !== location.origin) return;
    if (message?.type === 'sifi-edition-cache-update') {
      const record = message.record;
      const previous = records.get(record?.feed);
      if (previous && core.valid(record,account,record.feed) && previous.edition === record.edition) records.set(record.feed,record);
      return;
    }
    if (message?.type !== 'sifi-edition-response') return;
    const pending = pendingMessages.get(message.id);
    if (!pending) return;
    pendingMessages.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(message.error));
    else pending.resolve(message.record);
  });
  function stored(action, owner, feed, record) {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => {
        pendingMessages.delete(id);
        reject(new Error('Edition storage did not respond. Reload to reconnect.'));
      }, 7000);
      pendingMessages.set(id, {resolve, reject, timer});
      window.postMessage({type:'sifi-edition-request', id, action, account:owner, feed, record}, location.origin);
    });
  }
  function checkAccount(owner) {
    if (accountId() !== owner) throw new DOMException('Account changed', 'AbortError');
  }
  async function capture(owner, feed, slot, url, init) {
    checkAccount(owner);
    const saved = await stored('get', owner, feed);
    checkAccount(owner);
    // A tab opened before a boundary may keep the edition it was already reading.
    // A newly opened tab must never replace a newer edition captured elsewhere.
    if (core.valid(saved, owner, feed) && Number(saved.edition) >= Number(slot.id)) return saved;
    try {
      const next = core.request(url, init);
      const response = await nativeFetch(next.url, {...next.init, credentials:'include', signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw new Error('X could not load this edition.');
      const frozen = core.freeze(await response.json());
      checkAccount(owner);
      const record = {
        schema:core.SCHEMA, account:owner, feed, edition:slot.id,
        startsAt:slot.startsAt, nextAt:slot.nextAt, label:slot.label,
        capturedAt:Date.now(), count:frozen.count, payload:frozen.payload,
      };
      return await stored('put', owner, feed, record);
    } catch (error) {
      checkAccount(owner);
      if (core.valid(saved, owner, feed)) { problem = 'Showing your saved edition. The next one could not load.'; return saved; }
      throw error;
    }
  }
  async function edition(feed, url, init) {
    syncVisit();
    const owner = account;
    if (!owner) throw new Error('Sign in to read your saved edition.');
    const slot = visit;
    const memory = records.get(feed);
    if (core.valid(memory, owner, feed) && Number(memory.edition) >= Number(slot.id)) return memory;
    const key = `${owner}.${feed}.${slot.id}`;
    attempted.add(key);
    if (!jobs.has(key)) {
      const run = () => capture(owner, feed, slot, url, init);
      // Web Locks serialize captures across this origin's tabs, including reloads.
      const job = navigator.locks ? navigator.locks.request(`sifi-edition:${key}`, run) : run();
      jobs.set(key, job.finally(() => jobs.delete(key)));
    }
    const record = await jobs.get(key);
    checkAccount(owner);
    records.set(feed, record);
    updateUI();
    return record;
  }
  async function homeResponse(feed, url, init) {
    try {
      const record = await edition(feed, url, init);
      const data = core.hasCursor(url, init) ? core.empty(record.payload) : record.payload;
      return new Response(JSON.stringify(data), {status:200, headers:{'content-type':'application/json;charset=utf-8'}});
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      problem = 'Edition unavailable. Reload to try again.';
      updateUI();
      // Never silently replace a saved edition with a live, unbounded feed.
      return new Response(JSON.stringify({errors:[{message:problem}]}), {status:503, headers:{'content-type':'application/json'}});
    }
  }
  async function rememberReaction(url, body, response, owner) {
    const change = core.reaction(url,body,location.origin);
    if (!change || !response?.data || response.errors?.length || owner !== accountId()) return;
    for (const [feed,record] of records) records.set(feed,core.applyReaction(record,change));
    try { await stored('react',owner,'following',change); } catch { /* Native action already succeeded. */ }
  }
  window.fetch = async function(input, init) {
    const request = input instanceof Request ? input : null;
    const url = request ? request.url : new URL(String(input),location.href).href;
    const feed = core.operation(url, location.origin);
    const method = String(init?.method || request?.method || 'GET').toUpperCase();
    if (!feed || !['GET','POST'].includes(method)) {
      const actionUrl = new URL(url,location.href);
      const observed = method === 'POST' && actionUrl.origin === location.origin && /\/(FavoriteTweet|UnfavoriteTweet|CreateBookmark|DeleteBookmark)$/.test(actionUrl.pathname);
      if (!observed) return nativeFetch(input,init);
      const owner = accountId();
      const body = init?.body ?? (request && method === 'POST' ? await request.clone().text() : undefined);
      const response = await nativeFetch(input, init);
      if (response.ok && core.reaction(url,body,location.origin)) response.clone().json().then(data => rememberReaction(url,body,data,owner)).catch(() => {});
      return response;
    }
    const signal = init?.signal || request?.signal;
    signal?.throwIfAborted();
    const body = init?.body ?? (request && method === 'POST' ? await request.clone().text() : undefined);
    const response = await homeResponse(feed, url, {...init, method, body, headers:new Headers(init?.headers || request?.headers)});
    signal?.throwIfAborted();
    return response;
  };

  // Home uses XHR on mobile. Serve its cached JSON through the normal XHR events;
  // all other requests, including likes, replies, media and search, remain native.
  const proto = XMLHttpRequest.prototype;
  const native = Object.fromEntries(['open','send','abort','setRequestHeader','getResponseHeader','getAllResponseHeaders'].map(name => [name, proto[name]]));
  const descriptors = Object.fromEntries(['readyState','status','statusText','responseURL','response','responseText'].map(name => [name,Object.getOwnPropertyDescriptor(proto,name)]));
  const tracked = new WeakMap();
  const actions = new WeakMap();
  function clear(xhr) {
    const previous = tracked.get(xhr);
    if (!previous) return;
    previous.cancelled = true;
    clearTimeout(previous.timer);
    for (const name of Object.keys(descriptors)) delete xhr[name];
    tracked.delete(xhr);
  }
  function emit(xhr, name) { xhr.dispatchEvent(new Event(name)); }
  proto.open = function(method, url, async = true) {
    clear(this);
    const oldAction = actions.get(this);
    if (oldAction) this.removeEventListener('load',oldAction.onLoad);
    actions.delete(this);
    const result = native.open.apply(this, arguments);
    const feed = core.operation(String(url), location.origin);
    if (!feed || async === false || !['GET','POST'].includes(String(method).toUpperCase())) {
      if (String(method).toUpperCase() === 'POST' && /\/(FavoriteTweet|UnfavoriteTweet|CreateBookmark|DeleteBookmark)$/.test(String(url))) {
        const action = {url:String(url),owner:accountId(),body:null};
        action.onLoad = () => {
          if (this.status < 200 || this.status >= 300) return;
          try { const data = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);rememberReaction(action.url,action.body,data,action.owner); } catch {}
        };
        actions.set(this,action);this.addEventListener('load',action.onLoad);
      }
      return result;
    }
    const meta = {feed, url:new URL(url,location.href).href, method:String(method).toUpperCase(), headers:new Headers(), state:1, status:0, text:'', started:false, cancelled:false};
    tracked.set(this, meta);
    for (const name of Object.keys(descriptors)) {
      Object.defineProperty(this, name, {configurable:true, get:() => {
        if (name === 'readyState') return meta.state;
        if (name === 'status') return meta.status;
        if (name === 'statusText') return meta.status ? meta.status === 200 ? 'OK' : 'Service Unavailable' : '';
        if (name === 'responseURL') return meta.status ? meta.url : '';
        if (name === 'responseText') {
          if (this.responseType && this.responseType !== 'text') throw new DOMException('Invalid response type', 'InvalidStateError');
          return meta.text;
        }
        if (this.responseType === 'json') return meta.state === 4 ? JSON.parse(meta.text || 'null') : null;
        return meta.text;
      }});
    }
    return result;
  };
  proto.setRequestHeader = function(name, value) {
    const meta = tracked.get(this);
    if (meta) meta.headers.append(name, value);
    return native.setRequestHeader.apply(this, arguments);
  };
  proto.getResponseHeader = function(name) {
    const meta = tracked.get(this);
    return meta ? meta.state >= 2 && name.toLowerCase() === 'content-type' ? 'application/json;charset=utf-8' : null : native.getResponseHeader.apply(this, arguments);
  };
  proto.getAllResponseHeaders = function() {
    const meta = tracked.get(this);
    return meta ? meta.state >= 2 ? 'content-type: application/json;charset=utf-8\r\n' : '' : native.getAllResponseHeaders.apply(this, arguments);
  };
  function fail(xhr, meta, name) {
    if (meta.cancelled) return;
    meta.cancelled = true;
    clearTimeout(meta.timer);
    meta.state = 4;
    meta.status = 0;
    meta.text = '';
    emit(xhr,'readystatechange');emit(xhr,name);emit(xhr,'loadend');
    if (name === 'abort') meta.state = 0;
  }
  proto.abort = function() {
    const meta = tracked.get(this);
    if (!meta) return native.abort.apply(this, arguments);
    if (meta.started && meta.state !== 4) fail(this,meta,'abort');
    else meta.state = 0;
  };
  proto.send = function(body) {
    const meta = tracked.get(this);
    if (!meta) {
      const action = actions.get(this);
      if (action) action.body = body;
      return native.send.apply(this, arguments);
    }
    if (meta.started || meta.state !== 1) throw new DOMException('Request already sent','InvalidStateError');
    meta.started = true;
    emit(this,'loadstart');
    if (this.timeout) meta.timer = setTimeout(() => fail(this,meta,'timeout'),this.timeout);
    homeResponse(meta.feed,meta.url,{method:meta.method,headers:meta.headers,body}).then(async response => {
      const text = await response.text();
      if (meta.cancelled || tracked.get(this) !== meta) return;
      clearTimeout(meta.timer);
      meta.status = response.status;
      for (const state of [2,3,4]) {
        meta.state = state;
        if (state >= 3) meta.text = text;
        emit(this,'readystatechange');
        if (meta.cancelled || tracked.get(this) !== meta) return;
      }
      emit(this,'load');
      if (!meta.cancelled && tracked.get(this) === meta) emit(this,'loadend');
    }).catch(() => fail(this,meta,'error'));
  };

  function makeElement(tag) {
    const element = document.createElement(tag);
    element.attachShadow({mode:'open'});
    return element;
  }
  const clock = time => new Date(time).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
  function removeUI() {
    window.SifiEditionRefresh?.setEnabled(false);
    header?.remove();ending?.remove();
    header = ending = null;
    toolbarObserver?.disconnect();toolbarObserver = toolbar = null;
    endObserver?.disconnect();endObserver = endCell = null;
    approachObserver?.disconnect();approachObserver = null;
    endListObserver?.disconnect();endListObserver = null;
    renderKey = '';displayedEdition = '';
  }
  function fitToolbar() {
    if (!ending) return;
    const next = [...document.querySelectorAll('[data-testid="BottomBar"]')].find(el => el.getBoundingClientRect().height > 20);
    if (next !== toolbar) {
      toolbarObserver?.disconnect();toolbar = next;
      toolbarObserver = new ResizeObserver(fitToolbar);
      if (toolbar) toolbarObserver.observe(toolbar);
    }
    ending.style.setProperty('--edition-bottom',`${Math.ceil(toolbar?.getBoundingClientRect().height || 0) + 24}px`);
  }
  function fitEnding(record, region) {
    const articles = region.querySelectorAll('article[data-testid="tweet"]');
    const last = articles[articles.length - 1];
    const id = last?.querySelector('time')?.closest('a')?.href.match(/\/status\/(\d+)/)?.[1];
    if (!id || id !== core.lastTweetId(record?.payload)) return;
    const cell = last.closest('[data-testid="cellInnerDiv"]');
    if (!cell) return;
    // Place our footer in X's existing empty tail. Native card dimensions and
    // the virtualizer's own height remain untouched.
    const gap = Math.max(0,region.getBoundingClientRect().bottom - cell.getBoundingClientRect().bottom);
    const margin = `${-Math.floor(gap)}px`;
    if (ending.style.marginTop !== margin) ending.style.marginTop = margin;
    if (endCell !== cell) {
      endObserver?.disconnect();endCell = cell;
      endObserver = new ResizeObserver(() => { if (ending?.isConnected) fitEnding(record,region); });
      endObserver.observe(cell);endObserver.observe(region);
    }
  }
  function updateUI() {
    syncVisit();
    if (!wasHome) { if (header || ending) removeUI(); return; }
    const column = document.querySelector('[data-testid="primaryColumn"]');
    const tabs = [...document.querySelectorAll('[role="tablist"] [role="tab"]')];
    const selected = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
    if (!column || selected < 0) return;
    const feed = selected === 1 ? 'following' : 'for-you';
    const record = records.get(feed);
    const region = column.querySelector('section[role="region"]');
    if (!region || (!record && !problem)) return;
    if (!header?.isConnected || !ending?.isConnected || header.nextElementSibling !== region) {
      removeUI();
      header = makeElement('sifi-edition-heading');
      ending = makeElement('sifi-edition-ending');
      region.before(header);region.after(ending);
      fitToolbar();
    }
    const editionKey = `${feed}|${record?.edition}`;
    if (displayedEdition !== editionKey) {
      ending.style.marginTop = '0px';endObserver?.disconnect();endObserver = endCell = null;displayedEdition = editionKey;
      approachObserver?.disconnect();
      endListObserver?.disconnect();
      approachObserver = new IntersectionObserver(entries => {
        endListObserver?.disconnect();
        if (!record || !entries.some(entry => entry.isIntersecting)) return;
        fitEnding(record,region);
        const list = region.querySelector('[data-testid="cellInnerDiv"]')?.parentElement;
        if (list) {
          // Observe only direct row mounts near the end, never card contents.
          endListObserver = new MutationObserver(() => fitEnding(record,region));
          endListObserver.observe(list,{childList:true});
        }
      },{rootMargin:'1000px 0px'});
      approachObserver.observe(ending);
    }
    // X may restore an old Home screen entirely from its SPA cache. On a new
    // scheduled visit only, reload once to let X build the next native edition.
    if (record && Number(record.edition) < Number(visit.id) && !refreshing &&
        !attempted.has(`${account}.${feed}.${visit.id}`) && Date.now() - enteredAt > 1000) {
      const draft = [...document.querySelectorAll('textarea,[contenteditable="true"]')].some(el => (el.value || el.textContent || '').trim());
      if (!draft) { refreshing = true; location.reload(); return; }
    }
    window.SifiEditionRefresh?.setEnabled(!!record && /^\/home\/?$/.test(location.pathname));
    if (record) fitEnding(record,region);
    const light = getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)';
    const key = `${feed}|${record?.edition}|${record?.capturedAt}|${problem}|${light}`;
    if (renderKey === key) return;
    renderKey = key;
    const color = light ? '#0f1419' : '#e7e9ea';
    const muted = light ? '#536471' : '#8b98a5';
    const border = light ? '#eff3f4' : '#2f3336';
    const style = `:host{display:block;color:${color};font:13px/1.5 system-ui,sans-serif}*{box-sizing:border-box}p{margin:0}.muted{color:${muted}}`;
    header.shadowRoot.innerHTML = `<style>${style}.label{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:11px 16px 9px;border-bottom:1px solid ${border}}strong{font-size:14px;font-weight:600}.details{font-size:12px;margin-top:2px}.mark{font-size:10px;letter-spacing:.12em;white-space:nowrap}</style><div class="label"><div><strong></strong><p class="details muted"></p></div><span class="mark muted">SIFI</span></div>`;
    const title = header.shadowRoot.querySelector('strong');
    const details = header.shadowRoot.querySelector('.details');
    if (record) {
      const day = new Date(record.capturedAt).toLocaleDateString(undefined,{day:'numeric',month:'short'});
      title.textContent = `${record.label} edition`;
      details.textContent = `${record.count} posts · Saved ${clock(record.capturedAt)} · Next ${clock(record.nextAt)}`;
      header.setAttribute('aria-label',`${record.label} edition, ${day}. ${details.textContent}`);
    } else { title.textContent = 'Edition unavailable'; details.textContent = problem; }
    // The footer occupies the native timeline’s empty tail. Stack it above that
    // positioned container so the visible links and buttons receive real taps.
    ending.shadowRoot.innerHTML = `<style>${style}:host{position:relative;z-index:1;padding:24px 24px max(var(--edition-bottom,100px),env(safe-area-inset-bottom));border-top:1px solid ${border};text-align:center}.line{width:24px;height:2px;margin:0 auto 14px;background:${muted};opacity:.5}strong{font-size:15px;font-weight:600}.muted{margin-top:6px;font-size:13px}</style><sifi-shortcuts data-mode="cards"></sifi-shortcuts><div class="line"></div><strong></strong><p class="muted"></p>`;
    ending.shadowRoot.querySelector('strong').textContent = record ? 'You’re caught up with this edition.' : 'Your edition could not load.';
    ending.shadowRoot.querySelector('p').textContent = problem || (record ? `Next edition after ${clock(record.nextAt)} when you return to Home.` : 'Reload to try again.');
  }
  // No global observer, scroll listener, card rendering or changes to native sizing.
  setInterval(updateUI, 500);
  window.addEventListener('popstate', syncVisit);
  for (const name of ['pushState','replaceState']) {
    const original = history[name];
    history[name] = function() { const result = original.apply(this,arguments);syncVisit();return result; };
  }
})();
