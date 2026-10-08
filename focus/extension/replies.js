(() => {
  const core = window.SifiReplyPages;
  const FORWARD_DELAY = 1500;
  const nativeFetch = window.fetch.bind(window);
  const sessions = new Map();
  let current = null;
  let host = null;
  let pending = false;
  let error = '';
  let lastPath = '';
  let toolbar = null;
  let toolbarObserver = null;
  let rootObserver = null;
  let rootRegion = null;
  let mountTimer = null;
  const rawThreadId = () => location.pathname.match(/^\/[^/]+\/status\/(\d+)\/?$/)?.[1];
  const taggedReplyId = () => {
    const id = rawThreadId();
    return id && new URL(location.href).searchParams.get('sifi_native_reply') === id ? id : null;
  };
  let nativeThread = taggedReplyId();
  function nativeReplyId() {
    const tagged = taggedReplyId();
    if (tagged) nativeThread = tagged;
    else if (rawThreadId() !== nativeThread) nativeThread = null;
    return nativeThread;
  }
  const threadId = () => nativeReplyId() ? undefined : rawThreadId();
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function operation(url) {
    try {
      const parsed = new URL(url, location.href);
      if (parsed.origin !== location.origin || !parsed.pathname.endsWith('/TweetDetail')) return null;
      const variables = JSON.parse(parsed.searchParams.get('variables') || '{}');
      if (!variables.focalTweetId || variables.focalTweetId === nativeReplyId()) return null;
      return { url: parsed, variables };
    } catch { return null; }
  }
  function session(id) {
    if (!sessions.has(id)) sessions.set(id, { id, page:1, replies:[], cursor:null, request:null, ready:false });
    const value = sessions.get(id);
    sessions.delete(id);
    sessions.set(id, value);
    while (sessions.size > 2) sessions.delete(sessions.keys().next().value);
    return value;
  }
  function rememberRequest(id, request) {
    session(id).request = request;
  }
  function consume(data, url) {
    const op = operation(url);
    if (!op) return data;
    const parsed = core.read(data, op.variables.focalTweetId);
    if (!parsed.valid) return data;
    const state = session(op.variables.focalTweetId);
    if (!state.ready) {
      state.replies = core.merge([], parsed.replies);
      state.cursor = parsed.cursor;
    }
    state.ready = true;
    if (state.id === threadId()) { current = state; scheduleMount(); }
    // X renders the original post and its composer. Our finite, ordinary-flow
    // reply reader owns the comments, so its virtualizer never owns their height.
    return core.shape(data, parsed.context, [], 1) || data;
  }

  window.fetch = async function (input, init) {
    const url = input instanceof Request ? input.url : String(input);
    const op = operation(url);
    if (!op) return nativeFetch(input, init);
    rememberRequest(op.variables.focalTweetId, { url, init:{...init, headers:new Headers(init?.headers || (input instanceof Request ? input.headers : undefined))} });
    const response = await nativeFetch(input, init);
    if (!response.ok) return response;
    try {
      const shaped = consume(await response.clone().json(), url);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(JSON.stringify(shaped), {status:response.status, statusText:response.statusText, headers});
    } catch { return response; }
  };
  const proto = XMLHttpRequest.prototype;
  const nativeOpen = proto.open;
  const nativeHeader = proto.setRequestHeader;
  const responseText = Object.getOwnPropertyDescriptor(proto, 'responseText').get;
  const responseValue = Object.getOwnPropertyDescriptor(proto, 'response').get;
  const tracked = new WeakMap();
  proto.open = function (method, url) {
    const previous = tracked.get(this);
    if (previous) {
      this.removeEventListener('readystatechange', previous.onReady);
      delete this.responseText;
      delete this.response;
      tracked.delete(this);
    }
    const result = nativeOpen.apply(this, arguments);
    const op = operation(String(url));
    if (method.toUpperCase() !== 'GET' || !op) return result;
    const meta = {url:String(url),headers:new Headers(),value:null,done:false};
    tracked.set(this, meta);
    const transform = () => {
      if (meta.done || this.readyState !== 4 || this.status !== 200) return;
      meta.done = true;
      rememberRequest(op.variables.focalTweetId, {url:meta.url,init:{headers:meta.headers,credentials:'include'}});
      try {
        const raw = this.responseType === 'json' ? responseValue.call(this) : JSON.parse(responseText.call(this));
        meta.value = consume(raw, meta.url);
      } catch { meta.value = null; }
    };
    Object.defineProperty(this, 'responseText', {configurable:true,get:() => {
      transform();
      return meta.value && (!this.responseType || this.responseType === 'text') ? JSON.stringify(meta.value) : responseText.call(this);
    }});
    Object.defineProperty(this, 'response', {configurable:true,get:() => {
      transform();
      if (!meta.value) return responseValue.call(this);
      return this.responseType === 'json' ? meta.value : JSON.stringify(meta.value);
    }});
    meta.onReady = transform;
    this.addEventListener('readystatechange', transform);
    return result;
  };
  proto.setRequestHeader = function (name, value) {
    tracked.get(this)?.headers.set(name, value);
    return nativeHeader.apply(this, arguments);
  };

  async function ensurePage(state, target, signal) {
    const needed = Math.min(target * core.PAGE_SIZE, core.MAX_REPLIES);
    let batches = 0;
    while (state.replies.length < needed && state.cursor && batches++ < 4) {
      if (!state.request) throw new Error('Replies are not ready yet. Please try again.');
      const cursor = state.cursor;
      const url = new URL(state.request.url, location.href);
      const variables = JSON.parse(url.searchParams.get('variables'));
      variables.cursor = cursor;
      url.searchParams.set('variables', JSON.stringify(variables));
      const response = await nativeFetch(url, {...state.request.init,signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
      if (!response.ok) throw new Error(response.status === 429 ? 'X is limiting requests. Try again in a moment.' : 'Could not load replies. Please try again.');
      const parsed = core.read(await response.json(), state.id);
      if (current !== state || threadId() !== state.id) return false;
      state.replies = core.merge(state.replies, parsed.replies);
      state.cursor = parsed.cursor === cursor ? null : parsed.cursor;
    }
    return state.replies.length > (target - 1) * core.PAGE_SIZE;
  }
  let pageAbort = null;
  async function go(target) {
    const state = current;
    if (pending || !state?.ready || target === state.page || target < 1 || target > core.MAX_PAGES) return;
    pending = true;
    error = '';
    updateControls();
    pageAbort = new AbortController();
    try {
      const [available] = await Promise.all([ensurePage(state,target,pageAbort.signal),wait(target > state.page ? FORWARD_DELAY : 0)]);
      if (current !== state || threadId() !== state.id) return;
      if (!available) { error = 'End of this conversation.'; return; }
      state.page = target;
      renderReplies();
      // One intentional move to the new page's first reply; no scroll trapping.
      host.shadowRoot.querySelector('.reply-list').scrollIntoView({block:'start',behavior:'instant'});
    } catch (cause) {
      if (current === state && cause.name !== 'AbortError') error = cause.message || 'Could not load replies. Please try again.';
    } finally {
      if (current === state) { pending = false; updateControls(); }
    }
  }

  function safeUrl(value) {
    try { const url = new URL(value,location.origin);return ['http:','https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }
  function link(text, href, className) {
    const element = node('a',className,text);
    element.href = safeUrl(href) || '#';
    element.rel = 'noopener noreferrer';
    return element;
  }
  function result(row) {
    const value = row.item.item.itemContent.tweet_results.result;
    return value.tweet || value;
  }
  function body(tweet) {
    const container = node('div','text');
    const value = tweet.note_tweet?.note_tweet_results?.result;
    let text = value?.text || tweet.legacy?.full_text || '';
    const urls = tweet.legacy?.entities?.urls || [];
    const mediaLinks = new Set((tweet.legacy?.extended_entities?.media || []).map(m=>m.url));
    for (const part of text.split(/(https?:\/\/[^\s]+|@[A-Za-z0-9_]{1,15}\b|#[\p{L}\p{N}_]+)/u)) {
      if (!part) continue;
      if (mediaLinks.has(part)) continue;
      if (/^https?:\/\//.test(part)) {
        const expanded = urls.find(u=>u.url===part);
        container.append(link(expanded?.display_url || part,expanded?.expanded_url || part));
      } else if (part.startsWith('@')) container.append(link(part,`/${part.slice(1)}`));
      else if (part.startsWith('#')) container.append(link(part,`/hashtag/${encodeURIComponent(part.slice(1))}`));
      else container.append(document.createTextNode(part));
    }
    return container;
  }
  function card(row) {
    const tweet = result(row);
    const userResult = tweet.core?.user_results?.result;
    const user = userResult?.user || userResult;
    const name = user?.core?.name || user?.legacy?.name || 'X user';
    const handle = user?.core?.screen_name || user?.legacy?.screen_name;
    const permalink = handle ? `/${handle}/status/${row.id}` : `/i/web/status/${row.id}`;
    const article = node('article','reply');
    const avatar = link('',handle?`/${handle}`:permalink,'avatar');
    const imageUrl = safeUrl(user?.avatar?.image_url || user?.legacy?.profile_image_url_https);
    if (imageUrl) {
      const image = node('img');image.src=imageUrl;image.alt='';image.loading='lazy';image.width=40;image.height=40;avatar.append(image);
    } else avatar.textContent = name.slice(0,1).toUpperCase();
    const content = node('div','content');
    const heading = node('div','author');
    heading.append(link(name,handle?`/${handle}`:permalink,'name'));
    if (handle) heading.append(node('span','handle',`@${handle}`));
    const date = new Date(tweet.legacy?.created_at);
    if (!Number.isNaN(date.getTime())) {
      const time = link(date.toLocaleDateString(undefined,{month:'short',day:'numeric'}),permalink,'date');
      time.title = date.toLocaleString();heading.append(time);
    }
    content.append(heading,body(tweet));
    const media = tweet.legacy?.extended_entities?.media || [];
    if (media.length) {
      const group = node('div','media');
      for (const item of media.slice(0,4)) {
        const image = node('img');
        const src = safeUrl(item.media_url_https);
        if (!src) continue;
        image.src=src;image.alt=item.ext_alt_text || (item.type==='photo'?'Reply image':'Video preview');image.loading='lazy';
        const dimensions = item.original_info || item.sizes?.large;
        const width = Number(dimensions?.width || dimensions?.w);
        const height = Number(dimensions?.height || dimensions?.h);
        image.width = width > 0 ? width : 640;
        image.height = height > 0 ? height : 360;
        image.style.aspectRatio = `${image.width} / ${image.height}`;
        const preview=link('',permalink,'media-link');preview.append(image);
        if (item.type!=='photo') preview.append(node('span','video-label','▶ Open video'));
        group.append(preview);
      }
      content.append(group);
    }
    const quoteResult = tweet.quoted_status_result?.result;
    const quote = quoteResult?.tweet || quoteResult;
    if (quote?.legacy?.full_text) {
      const quoted = link('',`/i/web/status/${quote.rest_id}`,'quote');quoted.append(node('span',null,quote.legacy.full_text));content.append(quoted);
    }
    const nativeUrl = new URL(permalink, location.origin);
    nativeUrl.searchParams.set('sifi_native_reply', row.id);
    const openReply = link('Open reply ↗', nativeUrl.href, 'open-reply');
    openReply.addEventListener('click', event => {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      // A fresh native thread avoids reusing X's already-shaped reply cache.
      location.assign(nativeUrl.href);
    });
    content.append(openReply);
    article.append(avatar,content);
    return article;
  }
  function renderReplies() {
    if (!host || !current?.ready) return;
    const list = host.shadowRoot.querySelector('.reply-list');
    const start = (current.page - 1) * core.PAGE_SIZE;
    const rows = current.replies.slice(start,start + core.PAGE_SIZE);
    list.replaceChildren(...rows.map(card));
    if (!rows.length) list.append(node('p','empty','No replies in this conversation yet.'));
    updateControls();
  }
  function pageStatus(atCap, atEnd) {
    if (error) return error;
    if (pending) return 'Taking a short pause…';
    if (atCap) return 'Reply limit reached · 60 replies maximum.';
    if (atEnd) return 'End of this conversation.';
    return 'One page at a time.';
  }
  function updateControls() {
    if (!host || !current?.ready) return;
    const shadow = host.shadowRoot;
    const start = (current.page - 1) * core.PAGE_SIZE;
    const end = Math.min(start + core.PAGE_SIZE, current.replies.length);
    const atCap = current.page === core.MAX_PAGES;
    const atEnd = !current.cursor && end === current.replies.length;
    const knownPages = Math.ceil(current.replies.length / core.PAGE_SIZE);
    shadow.querySelector('.range').textContent = end ? `Replies ${start + 1}–${end}` : 'Replies';
    shadow.querySelector('.summary').textContent = `Page ${current.page} · ${core.MAX_PAGES} pages maximum`;
    shadow.querySelector('.status').textContent = pageStatus(atCap, atEnd);
    host.setAttribute('aria-busy', String(pending));
    for (const button of shadow.querySelectorAll('.pages button')) {
      const target = Number(button.dataset.page);
      button.disabled = pending || target === current.page || (target > knownPages && !current.cursor);
      if (target === current.page) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    const previous = shadow.querySelector('.previous');
    const next = shadow.querySelector('.next');
    previous.dataset.page = current.page - 1;
    next.dataset.page = current.page + 1;
    previous.disabled = pending || current.page === 1;
    next.disabled = pending || atCap || atEnd;
    next.textContent = pending ? 'Please wait…' : atCap || atEnd ? 'Finished' : 'Next page';
  }
  function syncToolbar() {
    if (!host) return;
    const next = [...document.querySelectorAll('[data-testid="BottomBar"]')]
      .find(element => element.getBoundingClientRect().height > 20) || null;
    if (next !== toolbar) {
      toolbarObserver?.disconnect();
      toolbar = next;
      if (toolbar) {
        toolbarObserver = new ResizeObserver(syncToolbar);
        toolbarObserver.observe(toolbar);
      }
    }
    const height = toolbar?.getBoundingClientRect().height || 0;
    host.style.setProperty('--sifi-toolbar-space', `${Math.ceil(height) + 16}px`);
  }

  // Only the small original-post shell is observed, never the comment list.
  // X reserves a screenful for its now-empty replies; trim that empty tail.
  function fitRoot() {
    if (!rootRegion || !host || current?.id !== threadId()) return;
    const cells = [...rootRegion.querySelectorAll('[data-testid="cellInnerDiv"]')];
    const meaningful = cells.filter(cell => cell.querySelector(
      'article[data-testid="tweet"], [data-testid="tweetTextarea_0"], [data-testid="inline_reply_offscreen"]'
    ));
    if (!meaningful.length) return;
    const rect = rootRegion.getBoundingClientRect();
    const bottom = Math.max(...meaningful.map(cell => cell.getBoundingClientRect().bottom));
    const height = Math.ceil(bottom - rect.top);
    if (height > 0 && rootRegion.style.getPropertyValue('--sifi-post-shell-height') !== `${height}px`) {
      rootRegion.style.setProperty('--sifi-post-shell-height', `${height}px`);
    }
    for (const cell of cells) {
      if (!meaningful.includes(cell)) cell.setAttribute('data-sifi-empty-tail', '');
    }
  }

  function mount() {
    if(!current?.ready || current.id!==threadId())return;
    const column=document.querySelector('[data-testid="primaryColumn"]');
    const region=column?.querySelector('section[role="region"]');
    if(!region || !region.querySelector('article[data-testid="tweet"]')){scheduleMount();return;}
    if(!host){
      host=document.createElement('sifi-reply-pages');
      host.setAttribute('aria-label','Paginated replies');
      host.attachShadow({mode:'open'}).innerHTML=`
      <style>
      :host{ display:block; box-sizing:border-box; padding:0 0 max(var(--sifi-toolbar-space,100px),env(safe-area-inset-bottom)); color:var(--sifi-text,#e7e9ea); font:15px/1.45 system-ui,sans-serif; }

      *{ box-sizing:border-box}
      .reply-list{ scroll-margin-top:64px}
      .reply{ display:flex; gap:10px; padding:14px 12px; border-bottom:1px solid var(--sifi-border,#2f3336)}

      a{ color:#1d9bf0; text-decoration:none}
      a:focus-visible,button:focus-visible{ outline:2px solid #1d9bf0; outline-offset:3px}
      .avatar{ width:40px; height:40px; flex:0 0 40px; border-radius:50%; background:var(--sifi-surface,#101418); display:flex; align-items:center; justify-content:center; overflow:hidden}
      .avatar img{ width:40px; height:40px; object-fit:cover}

      .content{ min-width:0; flex:1}
      .author{ display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 6px; font-size:14px}
      .name{ font-weight:700; color:inherit; overflow-wrap:anywhere}
      .handle,.date{ color:var(--sifi-muted,#8b98a5); font-size:12px}
      .text{ white-space:pre-wrap; overflow-wrap:anywhere; margin-top:3px}
      .media{ display:grid; gap:6px; margin-top:10px}
      .media-link{ display:block; position:relative}
      .media img{ display:block; width:100%; height:auto; max-height:280px; object-fit:contain; border-radius:12px; background:var(--sifi-surface,#101418)}
      .video-label{ display:block; margin-top:4px; font-size:12px}
      .quote{ display:block; border:1px solid var(--sifi-border,#2f3336); padding:10px; border-radius:12px; margin-top:8px; color:var(--sifi-muted,#8b98a5); white-space:pre-wrap; overflow-wrap:anywhere; font-size:13px}
      .open-reply{ display:inline-flex; align-items:center; min-height:36px; margin-top:5px; font-size:12px; color:var(--sifi-muted,#8b98a5)}
      .empty{ padding:20px 12px; color:var(--sifi-muted,#8b98a5)}

      .pager{ padding:14px 12px 0}
      .heading{ display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px}
      .range{ font-weight:700; font-size:14px}
      .summary{ color:var(--sifi-muted,#8b98a5); font-size:12px; margin-top:2px}
      .badge{ color:var(--sifi-muted,#8b98a5); font-size:11px; white-space:nowrap}
      .pages{ display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:6px}
      button{ appearance:none; border:1px solid var(--sifi-border,#2f3336); background:transparent; color:inherit; min-width:0; min-height:46px; padding:8px 4px; border-radius:10px; font:600 15px system-ui,sans-serif; cursor:pointer; touch-action:manipulation}
      button[aria-current="page"]{ background:#1d9bf0; border-color:#1d9bf0; color:#fff}
      button:disabled:not([aria-current="page"]){ cursor:default; opacity:.4}
      .actions{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto; gap:8px; margin-top:8px}
      .next{ background:var(--sifi-next,#182c3b)}
      .status{ min-height:18px; margin:10px 0 0; color:var(--sifi-muted,#8b98a5); font-size:12px}

      </style><div class="reply-list"></div><nav class="pager" aria-label="Reply pages"><div class="heading"><div><div class="range"></div><div class="summary"></div></div><span class="badge">SIFI Focus</span></div><div class="pages">${Array.from({length:core.MAX_PAGES},(_,i)=>`<button type="button" data-page="${i+1}" aria-label="Reply page ${i+1}">${i+1}</button>`).join('')}</div><div class="actions"><button type="button" class="previous">← Previous</button><button type="button" class="next">Next page</button><sifi-shortcuts data-mode="compact"></sifi-shortcuts></div><p class="status" role="status" aria-live="polite"></p></nav>`;
      host.shadowRoot.addEventListener('click',event=>{const button=event.target.closest('button[data-page]');if(button && !button.disabled)go(Number(button.dataset.page));});
      renderReplies();
    }
    if(region.nextElementSibling!==host)region.after(host);
    if(rootRegion!==region){
      rootObserver?.disconnect();
      rootRegion=region;
      region.setAttribute('data-sifi-post-shell','');
      rootObserver=new ResizeObserver(fitRoot);
      for(const cell of region.querySelectorAll('[data-testid="cellInnerDiv"]'))rootObserver.observe(cell);
    }
    document.documentElement.setAttribute('data-sifi-replies-active','');
    if(getComputedStyle(document.body).backgroundColor==='rgb(255, 255, 255)')for(const[key,value]of Object.entries({text:'#0f1419',muted:'#536471',border:'#cfd9de',surface:'#f7f9fa',next:'#e8f4fd'}))host.style.setProperty(`--sifi-${key}`,value);
    fitRoot();syncToolbar();
  }
  function scheduleMount() {
    if (mountTimer) return;
    mountTimer = setTimeout(() => {
      mountTimer = null;
      mount();
    }, 200);
  }
  function cleanup() {
    pageAbort?.abort();
    pageAbort = null;
    host?.remove();
    host = null;
    rootObserver?.disconnect();
    toolbarObserver?.disconnect();
    toolbar = null;
    if (rootRegion) {
      rootRegion.removeAttribute('data-sifi-post-shell');
      rootRegion.style.removeProperty('--sifi-post-shell-height');
      for (const element of rootRegion.querySelectorAll('[data-sifi-empty-tail]')) {
        element.removeAttribute('data-sifi-empty-tail');
      }
    }
    rootRegion = null;
    document.documentElement?.removeAttribute('data-sifi-replies-active');
    pending = false;
    error = '';
  }

  // Cheap route checks only. Replies never install a scroll/touch handler or
  // a document-wide MutationObserver, and never change the native toolbar.
  setInterval(() => {
    const routeKey = `${location.pathname}|${nativeReplyId() || ''}`;
    if (routeKey !== lastPath) {
      lastPath = routeKey;
      cleanup();
      const id = threadId();
      current = id ? sessions.get(id) || null : null;
    }
    if (threadId() && current?.ready && !host?.isConnected) scheduleMount();
  }, 500);
})();
