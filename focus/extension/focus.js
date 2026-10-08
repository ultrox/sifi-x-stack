(() => {
  const viewerSelector = '[data-testid="vss-scroll-view"]';
  const navigationKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
  let viewer = null;
  let lockedTop = 0;
  let activeVideo = null;
  let finished = false;
  let followingRequested = false;

  const isViewer = url => /\/mediaViewer\/?$|\/video\/\d+\/?$/.test(url.pathname);
  const videoId = url => url.searchParams.get('currentTweet') || url.pathname.match(/\/status\/(\d+)/)?.[1];
  const locked = () => isViewer(new URL(location.href)) || !!viewer;

  // Install before X registers gesture and completion handlers.
  function blockGesture(event) {
    if (!locked()) return;
    if (event.type === 'keydown' && !navigationKeys.has(event.key)) return;
    if (event.target instanceof Element && event.target.closest('[role="slider"], input, textarea, [contenteditable="true"]')) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  }
  for (const type of ['touchmove', 'wheel', 'keydown']) {
    window.addEventListener(type, blockGesture, { capture: true, passive: false });
  }
  window.addEventListener('ended', event => {
    if (!locked() || !(event.target instanceof HTMLVideoElement)) return;
    event.stopImmediatePropagation();
    event.target.pause();
    finished = true;
  }, true);
  window.addEventListener('play', event => {
    if (!locked() || !(event.target instanceof HTMLVideoElement)) return;
    if (activeVideo && event.target !== activeVideo) {
      event.stopImmediatePropagation();
      event.target.pause();
    } else if (event.target === activeVideo) {
      finished = false; // Explicit replay of the same clip remains available.
      event.target.loop = false;
    }
  }, true);

  // Also reject automatic next-video route changes while allowing exit/back.
  for (const name of ['pushState', 'replaceState']) {
    const original = history[name];
    history[name] = function (state, unused, url) {
      if (url != null) {
        const current = new URL(location.href);
        const next = new URL(url, current);
        if (locked() && isViewer(current) && isViewer(next) &&
            videoId(current) && videoId(next) && videoId(current) !== videoId(next)) return;
      }
      const result = original.apply(this, arguments);
      update();
      return result;
    };
  }

  function pinScroll() {
    if (viewer && viewer.scrollTop !== lockedTop) viewer.scrollTop = lockedTop;
  }

  function update() {
    const next = document.querySelector(viewerSelector);
    if (next !== viewer) {
      viewer?.removeEventListener('scroll', pinScroll);
      viewer = next;
      activeVideo = null;
      finished = false;
      if (viewer) {
        lockedTop = viewer.scrollTop;
        const videos = [...viewer.querySelectorAll('video')];
        const rect = viewer.getBoundingClientRect();
        activeVideo = videos.find(v => {
          const r = v.getBoundingClientRect();
          return r.bottom > rect.top && r.top < rect.bottom;
        }) || null;
        viewer.addEventListener('scroll', pinScroll, { passive: true });
      }
    }
    const root = document.documentElement;
    const videoMode = locked();
    if (root && root.hasAttribute('data-sifi-video-locked') !== videoMode) root.toggleAttribute('data-sifi-video-locked', videoMode);
    if (viewer) {
      pinScroll();
      for (const video of viewer.querySelectorAll('video')) {
        if (!activeVideo) activeVideo = video;
        video.loop = false;
        if ((video !== activeVideo || finished) && !video.paused) video.pause();
      }
    }

    const home = /^\/home\/?$/.test(location.pathname);
    const tabs = home ? document.querySelector('[role="tablist"]') : null;
    // Default once per document, when Home first becomes ready. Keep this flag
    // through SPA routes and tab remounts so Back preserves X's feed restoration.
    if (home && tabs && !followingRequested) {
      const choices = [...tabs.querySelectorAll('[role="tab"]')];
      // Home's second tab is Following, independent of the display language.
      if (choices.length >= 2) {
        followingRequested = true;
        if (choices[1].getAttribute('aria-selected') !== 'true') choices[1].click();
      }
    }
  }
  window.addEventListener('popstate', update);
  // Small fixed-selector checks; no feed-wide MutationObserver or scroll work.
  setInterval(update, 250);
  update();
})();
