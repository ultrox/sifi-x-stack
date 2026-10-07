/* Cosmetic pull-to-refresh. This module never requests or replaces feed data. */
(() => {
  const THRESHOLD = 80;
  const DURATION = 1600;
  let enabled = false;
  let gesture = null;
  let host = null;
  let state = 'idle';
  let timer = null;
  let frame = null;
  let distance = 0;

  function indicator() {
    if (host?.isConnected) return host;
    host = document.createElement('sifi-edition-refresh');
    host.hidden = true;
    host.attachShadow({mode:'open'}).innerHTML = `
      <style>
        :host{position:fixed;z-index:20;left:var(--refresh-left,50%);top:var(--refresh-top,100px);pointer-events:none;transform:translate(-50%,var(--refresh-pull,0px));opacity:var(--refresh-opacity,1);color:var(--refresh-text,#e7e9ea);font:13px/1.3 system-ui,sans-serif}
        :host([hidden]){display:none}
        .pill{display:flex;align-items:center;gap:9px;min-height:40px;padding:10px 15px;border-radius:24px;background:var(--refresh-bg,#16181c);border:1px solid var(--refresh-border,#2f3336);box-shadow:0 3px 12px #0003}
        svg{width:18px;height:18px;color:#1d9bf0;transform:rotate(var(--refresh-turn,0deg))}
        circle{fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:36 18}
        :host([data-state="loading"]) svg{animation:spin .8s linear infinite}
        :host([data-state="settling"]){transition:transform .18s ease-out,opacity .18s ease-out;opacity:0;transform:translate(-50%,-8px)}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(prefers-reduced-motion:reduce){:host([data-state="loading"]) svg{animation:none}:host([data-state="settling"]){transition:none}}
      </style>
      <div class="pill"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5"/></svg><span role="status" aria-live="polite"></span></div>`;
    document.documentElement.append(host);
    return host;
  }
  function setState(value) {
    state = value;
    host?.setAttribute('data-state',value);
  }
  function hide() {
    clearTimeout(timer);timer = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (host) { host.hidden = true; host.shadowRoot.querySelector('[role="status"]').textContent = ''; }
    setState('idle');
  }
  function settle() {
    setState('settling');
    timer = setTimeout(hide,180);
  }
  function draw() {
    frame = null;
    if (!host || state !== 'dragging') return;
    host.style.setProperty('--refresh-pull',`${Math.min(distance * .38,48)}px`);
    host.style.setProperty('--refresh-opacity',String(Math.min(1,distance / 40)));
    host.style.setProperty('--refresh-turn',`${distance * 3}deg`);
  }
  function removeGesture() {
    window.removeEventListener('touchmove',move,true);
    window.removeEventListener('touchend',end,true);
    window.removeEventListener('touchcancel',cancel,true);
    gesture = null;
  }
  function stop(event) {
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  function move(event) {
    if (!gesture) return;
    if (event.touches.length !== 1) { cancel(); return; }
    const touch = [...event.touches].find(t => t.identifier === gesture.id);
    if (!touch) { cancel(); return; }
    const dy = touch.clientY - gesture.y;
    const dx = Math.abs(touch.clientX - gesture.x);
    if (!gesture.claimed) {
      if (dy < -6 || (dx > 8 && dx > Math.abs(dy))) { removeGesture(); return; }
      if (dy < 8) return;
      if (!event.cancelable) { cancel(); return; }
      gesture.claimed = true;
      if (!gesture.busy) {
        indicator().hidden = false;
        host.shadowRoot.querySelector('[role="status"]').textContent = '';
        setState('dragging');
      }
    }
    stop(event);
    if (gesture.busy) return;
    distance = Math.max(0,dy);
    if (frame === null) frame = requestAnimationFrame(draw);
  }
  function end(event) {
    const completed = gesture;
    if (!completed) return;
    if (completed.claimed) stop(event);
    removeGesture();
    if (!completed.claimed || completed.busy) return;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (distance < THRESHOLD) { settle(); return; }
    host.style.setProperty('--refresh-pull','26px');
    host.style.setProperty('--refresh-opacity','1');
    host.shadowRoot.querySelector('[role="status"]').textContent = 'Loading…';
    setState('loading');
    // Fixed, cosmetic pause: no reload, API request, cache read or edition change.
    timer = setTimeout(settle,DURATION);
  }
  function cancel() {
    removeGesture();
    if (state !== 'loading') hide();
  }
  function start(event) {
    if (!enabled || !/^\/home\/?$/.test(location.pathname) || event.touches.length !== 1 || window.scrollY > 1) return;
    if (document.querySelector('[role="dialog"],[aria-modal="true"],[data-testid="Dropdown"]')) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('input,textarea,[contenteditable="true"],[role="slider"],video,[data-testid="videoPlayer"]')) return;
    const heading = document.querySelector('sifi-edition-heading');
    if (!heading?.isConnected) return;
    const touch = event.touches[0];
    const busy = state === 'loading';
    if (!busy) {
      hide();
      const element = indicator();
      const rect = heading.getBoundingClientRect();
      element.style.setProperty('--refresh-left',`${rect.left + rect.width / 2}px`);
      element.style.setProperty('--refresh-top',`${Math.max(8,rect.top)}px`);
      const light = getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)';
      for (const [name,value] of Object.entries(light ? {text:'#0f1419',bg:'#fff',border:'#cfd9de'} : {text:'#e7e9ea',bg:'#16181c',border:'#2f3336'})) element.style.setProperty(`--refresh-${name}`,value);
    }
    distance = 0;
    gesture = {id:touch.identifier,x:touch.clientX,y:touch.clientY,claimed:false,busy};
    // A blocking move listener exists only for a gesture starting at the top.
    window.addEventListener('touchmove',move,{capture:true,passive:false});
    window.addEventListener('touchend',end,{capture:true,passive:false});
    window.addEventListener('touchcancel',cancel,{capture:true,passive:true});
  }
  window.SifiEditionRefresh = {
    setEnabled(value) {
      value = !!value;
      if (enabled === value) return;
      enabled = value;
      document.documentElement.toggleAttribute('data-sifi-cosmetic-refresh',value);
      if (!value) { removeGesture(); hide(); }
    },
  };
  window.addEventListener('touchstart',start,{capture:true,passive:true});
  window.addEventListener('blur',cancel);
})();
