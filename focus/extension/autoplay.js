(() => {
  // A trusted click on this player authorizes this clip only. Page-level user
  // activation would also authorize unrelated videos further down the feed.
  const allowed = new WeakSet();
  let intent = null;
  function authorize(event) {
    if (!event.isTrusted || (event.type === 'keydown' && !['Enter', ' '].includes(event.key))) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const player = target.closest('[data-testid="videoPlayer"], [data-testid="videoComponent"], video');
    if (!player || target.closest('input, textarea, [contenteditable="true"], [role="slider"]')) return;
    intent = { player, until: Date.now() + 1200 };
  }
  window.addEventListener('click', authorize, true);
  window.addEventListener('keydown', authorize, true);
  function permitted(video) {
    if (allowed.has(video)) return true;
    if (intent && Date.now() <= intent.until && (intent.player === video || intent.player.querySelector('video') === video)) {
      allowed.add(video);
      intent = null;
      return true;
    }
    return false;
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (this instanceof HTMLVideoElement) {
      this.autoplay = false;
      this.loop = false;
      if (!permitted(this)) return Promise.reject(new DOMException('Tap the video to play it.', 'NotAllowedError'));
    }
    return play.apply(this, args);
  };
  window.addEventListener('play', event => {
    const video = event.target;
    if (!(video instanceof HTMLVideoElement)) return;
    video.loop = false;
    if (!permitted(video)) {
      video.pause();
      event.stopImmediatePropagation();
    }
  }, true);
  for (const type of ['pause', 'ended', 'emptied']) window.addEventListener(type, event => {
    if (event.target instanceof HTMLVideoElement) {
      allowed.delete(event.target);
      if (intent && (intent.player === event.target || intent.player.querySelector('video') === event.target)) intent = null;
    }
  }, true);
  function clean(video) {
    if (video.hasAttribute('autoplay')) video.removeAttribute('autoplay');
    if (video.hasAttribute('loop')) video.removeAttribute('loop');
    if (!video.paused && !allowed.has(video)) video.pause();
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.attributeName === 'src') allowed.delete(record.target);
        if (record.target instanceof HTMLVideoElement) clean(record.target);
      }
      for (const node of record.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLVideoElement) clean(node);
        for (const video of node.querySelectorAll('video')) clean(video);
      }
    }
  });
  observer.observe(document, {subtree:true, childList:true, attributes:true, attributeFilter:['autoplay','loop','src']});
  for (const video of document.querySelectorAll('video')) clean(video);
})();
