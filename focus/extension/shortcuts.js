/* One local destination list, shared by reply controls and the edition ending. */
(() => {
  'use strict';
  const core = globalThis.SifiShortcuts;
  let items = [], revision = 0, editor, dialog, body, opener, busy = false;
  const mounted = new Map();
  const css = `
    :host{display:block;font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--sc-text);--sc-text:#0f1419;--sc-muted:#536471;--sc-bg:#fff;--sc-soft:#f5f7f8;--sc-border:#cfd9de;--sc-accent:#147a5a}
    :host([data-dark]){--sc-text:#e7e9ea;--sc-muted:#8b98a5;--sc-bg:#15202b;--sc-soft:#1d2b37;--sc-border:#40505c;--sc-accent:#8de1bc}
    *{box-sizing:border-box}button,input,textarea{font:inherit}button,a{-webkit-tap-highlight-color:transparent}button{cursor:pointer;color:inherit;background:var(--sc-soft);border:1px solid var(--sc-border);border-radius:12px;min-height:46px;padding:10px 14px;font-weight:600}button:disabled{opacity:.5;cursor:default}button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--sc-accent);outline-offset:3px}
    a{color:inherit;text-decoration:none}.icon{display:inline-flex;align-items:center;justify-content:center;font-size:23px;flex:none;width:28px;height:28px;overflow:hidden}.icon img{width:100%;height:100%;object-fit:contain;border-radius:5px}p{margin:5px 0 0;color:var(--sc-muted)}
    img[hidden]{display:none}
    .app-presets{display:flex;flex-wrap:wrap;gap:8px}
    .compact{display:flex;gap:6px}.square{display:flex;align-items:center;justify-content:center;width:46px;height:46px;min-width:46px;padding:0;border:1px solid var(--sc-border);border-radius:12px;background:var(--sc-soft);font-size:24px}.compact .extra{display:none}@media(min-width:440px){.compact .extra{display:flex}}
    .cards{margin:0 0 26px;text-align:left}.card-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.eyebrow{font-size:12px;color:var(--sc-muted);font-weight:600;letter-spacing:.02em}.card{display:block;border:1px solid var(--sc-border);border-radius:16px;overflow:hidden;background:var(--sc-soft);margin-top:10px}.card-content{padding:16px}.card-title{display:flex;gap:12px;align-items:center}.card-title strong{flex:1;min-width:0;overflow-wrap:anywhere;font-size:16px}.arrow{color:var(--sc-muted);font-size:20px}.card p{font-size:14px;overflow-wrap:anywhere}.poster{display:block;width:100%;aspect-ratio:16/9;max-height:180px;object-fit:cover}.empty{width:100%;text-align:left;padding:18px;border-style:dashed;background:transparent;font-weight:400}.empty strong{display:block;font-size:15px;margin-bottom:4px}.empty span{font-size:13px;color:var(--sc-muted)}
    dialog{color:var(--sc-text);background:var(--sc-bg);border:1px solid var(--sc-border);border-radius:20px;padding:0;width:min(460px,calc(100vw - 24px));max-height:calc(100dvh - 24px);margin:auto;overflow:auto;overscroll-behavior:contain}dialog::backdrop{background:#0009}.editor-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px;border-bottom:1px solid var(--sc-border);position:sticky;top:0;background:var(--sc-bg);z-index:1}h2{font-size:19px;margin:0}.close{font-size:24px;padding:0;width:42px;min-height:42px;background:transparent;border:0}.body{padding:18px}.intro{margin:0 0 18px;font-size:14px}.row{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--sc-border);padding:12px 0}.row a{display:flex;align-items:center;gap:12px;flex:1;min-width:0}.row-text{min-width:0}.row strong,.row small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.row small{color:var(--sc-muted)}.row button{padding:8px 12px}.wide{width:100%;margin-top:18px}.primary{background:var(--sc-text);color:var(--sc-bg);border-color:transparent}.label{display:block;font-weight:600;margin:0 0 16px}.label>span{display:block;margin-bottom:6px}.optional{font-size:12px;font-weight:400;color:var(--sc-muted)}input:not([type=file]),textarea{display:block;width:100%;min-width:0;font-size:16px;line-height:1.4;padding:11px 12px;background:var(--sc-soft);color:var(--sc-text);border:1px solid var(--sc-border);border-radius:10px}textarea{resize:vertical;min-height:82px}.choices{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 16px}.choices button{font-size:22px;width:44px;padding:0}.media-options{margin:0 0 18px;border:1px solid var(--sc-border);border-radius:12px;padding:12px}.media-options summary{cursor:pointer;min-height:28px;font-weight:600}.media-options[open] summary{margin-bottom:12px}.media-options .label{font-weight:400}.image-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.preview{width:46px;height:46px;object-fit:cover;border-radius:8px}.hint{font-size:12px;margin:8px 0;color:var(--sc-muted)}.footer{display:flex;gap:8px;margin-top:18px}.footer button{flex:1}.remove{margin-top:12px;width:100%;background:transparent;color:var(--sc-muted);border:0}.error{color:#d34242;font-size:14px;margin:12px 0 0}.sr{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}
  `;
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, className, action) {
    const node = element('button', className, text); node.type = 'button';
    node.addEventListener('click', action); return node;
  }
  function picture(source, className, alt = '') {
    const node = element('img', className); if (source) node.src = source; node.alt = alt;
    node.referrerPolicy = 'no-referrer'; node.loading = 'lazy';
    node.addEventListener('error', () => { node.hidden = true; });
    node.addEventListener('load', () => { node.hidden = false; }); return node;
  }
  function icon(item) {
    const node = element('span', 'icon'); node.setAttribute('aria-hidden', 'true');
    node.append(item.iconImage ? picture(item.iconImage) : document.createTextNode(item.icon));
    return node;
  }
  function destination(item, className) {
    const link = element('a', className); link.href = item.url;
    link.title = item.title; link.setAttribute('aria-label', item.title);
    link.addEventListener('click', () => { if (dialog?.open) dialog.close(); });
    return link;
  }
  function dark() {
    const values = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g)?.map(Number);
    return values && values.length >= 3 && (values[3] === undefined || values[3] > 0) ?
      values[0] * .2126 + values[1] * .7152 + values[2] * .0722 < 128 : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function render(host) {
    const root = host.shadowRoot || host.attachShadow({mode: 'open'});
    root.replaceChildren(element('style', '', css));
    const add = () => openEditor(host, items.length ? null : {});
    if (host.dataset.mode === 'compact') {
      const bar = element('div', 'compact');
      items.slice(0, 2).forEach((item, index) => {
        const link = destination(item, `square${index ? ' extra' : ''}`); link.append(icon(item)); bar.append(link);
      });
      const plus = button('+', 'square', add); plus.title = 'Add or manage shortcuts'; plus.setAttribute('aria-label', plus.title);
      bar.append(plus); root.append(bar); return;
    }
    const cards = element('section', 'cards'); cards.setAttribute('aria-label', 'Your shortcuts');
    const heading = element('div', 'card-heading'); heading.append(element('span', 'eyebrow', 'A place to go next'));
    const plus = button('+', 'square', add); plus.setAttribute('aria-label', 'Add or manage shortcuts'); heading.append(plus); cards.append(heading);
    if (!items.length) {
      const empty = button('', 'empty', add);
      empty.append(element('strong', '', 'Add your first shortcut'), element('span', '', 'A website you’d like to spend time on.')); cards.append(empty);
    }
    for (const item of items) {
      const card = destination(item, 'card'); if (item.poster) card.append(picture(item.poster, 'poster'));
      const content = element('div', 'card-content'), title = element('div', 'card-title');
      title.append(icon(item), element('strong', '', item.title), element('span', 'arrow', '↗')); content.append(title);
      if (item.description) content.append(element('p', '', item.description));
      card.append(content); cards.append(card);
    }
    root.append(cards);
  }
  function reconcile() {
    if (!document.body) return;
    const isDark = dark();
    const hosts = ['sifi-reply-pages', 'sifi-edition-ending'].map(selector =>
      document.querySelector(selector)?.shadowRoot?.querySelector('sifi-shortcuts')).filter(Boolean);
    for (const host of mounted.keys()) if (!hosts.includes(host)) mounted.delete(host);
    for (const host of hosts) {
      host.toggleAttribute('data-dark', isDark);
      if (mounted.get(host) !== revision) { render(host); mounted.set(host, revision); }
    }
    editor?.toggleAttribute('data-dark', isDark);
  }
  function createEditor() {
    editor = element('sifi-shortcut-editor');
    const root = editor.attachShadow({mode: 'open'}); root.append(element('style', '', css));
    dialog = element('dialog'); dialog.setAttribute('aria-labelledby', 'shortcut-heading');
    const header = element('div', 'editor-head'), title = element('h2', '', 'Your shortcuts'); title.id = 'shortcut-heading';
    const close = button('×', 'close', () => { if (!busy) dialog.close(); }); close.setAttribute('aria-label', 'Close shortcuts');
    header.append(title, close); body = element('div', 'body'); dialog.append(header, body); root.append(dialog); document.body.append(editor);
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => {
      editor.removeAttribute('role'); editor.removeAttribute('aria-modal');
      if (opener?.isConnected) opener.shadowRoot?.querySelector('button')?.focus({preventScroll: true});
    });
  }
  function openEditor(source, item) {
    if (!editor) createEditor(); opener = source;
    editor.toggleAttribute('data-dark', dark()); editor.setAttribute('role', 'dialog'); editor.setAttribute('aria-modal', 'true');
    if (item) showForm(item); else showList();
    if (!dialog.open) dialog.showModal();
  }
  function heading(text) { editor.shadowRoot.querySelector('h2').textContent = text; body.replaceChildren(); dialog.scrollTop = 0; }
  function showList() {
    heading('Your shortcuts'); body.append(element('p', 'intro', 'Saved on this device. These links appear beside reply pages and at the end of every edition.'));
    for (const item of items) {
      const row = element('div', 'row'), link = destination(item), text = element('span', 'row-text');
      text.append(element('strong', '', item.title), element('small', '', core.destinationLabel(item.url))); link.append(icon(item), text);
      row.append(link, button('Edit', '', () => showForm(item))); body.append(row);
    }
    const add = button('+ Add shortcut', 'wide primary', () => showForm({})); add.disabled = items.length >= core.LIMIT; body.append(add);
    if (!items.length) body.append(element('p', 'hint', 'Choose a useful destination for when you’re done here.'));
  }
  async function save(operation) {
    const result = await chrome.runtime.sendMessage({type: 'sifi-shortcut-change', ...operation});
    if (!result || result.error) throw new Error(result?.error || 'Could not save. Reload X and try again.');
    items = core.read(result.value); revision++; reconcile();
  }
  async function resizeImage(file, poster) {
    if (!file.type.startsWith('image/') || file.size > 10000000) throw new Error('Choose an image smaller than 10 MB.');
    const bitmap = await createImageBitmap(file);
    try {
      let width = Math.min(bitmap.width, poster ? 960 : 128), height = Math.round(bitmap.height * width / bitmap.width);
      if (height > (poster ? 960 : 128)) { width = Math.round(width * (poster ? 960 : 128) / height); height = poster ? 960 : 128; }
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, width); canvas.height = Math.max(1, height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [.8, .6, .4]) {
        const value = canvas.toDataURL('image/webp', quality); if (value.length <= 220000) return value;
      }
      throw new Error('This image is too detailed. Try a smaller one.');
    } finally { bitmap.close(); }
  }
  function showForm(existing) {
    heading(existing.id ? 'Edit shortcut' : 'Add shortcut');
    const form = element('form'), fields = {}, images = {iconImage: existing.iconImage || '', poster: existing.poster || ''};
    const error = element('p', 'error'); error.setAttribute('role', 'alert');
    function field(name, title, options = {}) {
      const label = element('label', 'label'), caption = element('span', '', title);
      if (options.optional) caption.append(element('span', 'optional', ' · optional'));
      const input = element(options.multiline ? 'textarea' : 'input'); input.name = name;
      if (!options.multiline) input.type = 'text'; input.value = existing[name] || ''; input.maxLength = options.max || 2048;
      if (options.placeholder) input.placeholder = options.placeholder;
      if (options.url) { input.inputMode = 'url'; input.autocapitalize = 'off'; input.spellcheck = false; }
      input.required = !!options.required; fields[name] = input; label.append(caption, input); form.append(label); return input;
    }
    field('title', 'Title', {required: true, max: 60, placeholder: 'Something worth your time'});
    field('url', 'Website or Android app link', {required: true, url: true, max: 4096, placeholder: 'https://… or intent://…'});
    const presets = [
      {title: 'Gmail', icon: '✉', url: core.GMAIL},
      {title: 'Mochi', icon: '📚', url: core.MOCHI},
    ];
    const appButtons = element('div', 'app-presets');
    for (const preset of presets) appButtons.append(button(`${preset.icon} Use ${preset.title} app`, '', () => {
      const previous = presets.find(item => item.url === fields.url.value);
      if (!fields.title.value.trim() || fields.title.value === previous?.title) fields.title.value = preset.title;
      if (!fields.icon.value.trim() || fields.icon.value === previous?.icon) fields.icon.value = preset.icon;
      fields.url.value = preset.url;
    }));
    form.append(appButtons, element('p', 'hint', 'Choose an app to fill its link, or paste another Android intent link.'));
    field('icon', 'Icon', {max: 32, placeholder: '📚'});
    const choices = element('div', 'choices');
    for (const emoji of ['📚', '🌱', '🧠', '🎨', '📰', '↗']) choices.append(button(emoji, '', () => { fields.icon.value = emoji; }));
    form.append(choices); field('description', 'Short description', {optional: true, multiline: true, max: 180});
    const media = element('details', 'media-options'); media.append(element('summary', '', 'Custom icon & poster'));
    for (const [key, title] of [['iconImage', 'Icon image'], ['poster', 'Card poster']]) {
      const label = element('label', 'label'), address = element('input'); address.type = 'text'; address.inputMode = 'url'; address.autocapitalize = 'off'; address.spellcheck = false;
      address.placeholder = 'Image URL (optional)'; address.value = images[key].startsWith('data:') ? '' : images[key];
      label.append(element('span', '', title), address);
      const controls = element('div', 'image-actions'), preview = picture(images[key] || '', 'preview'); preview.hidden = !images[key];
      // An empty src should not request the current page.
      if (!images[key]) preview.removeAttribute('src');
      const file = element('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true;
      const update = () => { preview.hidden = !images[key]; if (images[key]) preview.src = images[key]; else preview.removeAttribute('src'); };
      address.addEventListener('input', () => { images[key] = address.value.trim(); preview.hidden = true; });
      file.addEventListener('change', async () => {
        if (!file.files[0]) return;
        setBusy(true); error.textContent = '';
        try { images[key] = await resizeImage(file.files[0], key === 'poster'); address.value = ''; update(); }
        catch (failure) { error.textContent = failure.message; }
        finally { setBusy(false); file.value = ''; }
      });
      controls.append(button('Choose image', '', () => file.click()), button('Clear', '', () => { images[key] = ''; address.value = ''; update(); }), preview, file);
      media.append(label, controls, element('p', 'hint', key === 'iconImage' ? 'An image replaces the emoji. Uploads stay on this device.' : 'Optional image for the larger end-of-edition card.'));
    }
    form.append(media, error);
    const footer = element('div', 'footer'), submit = element('button', 'primary', 'Save shortcut'); submit.type = 'submit';
    footer.append(button('Cancel', '', showList), submit); form.append(footer);
    function setBusy(value) { busy = value; for (const control of editor.shadowRoot.querySelectorAll('button,input,textarea')) control.disabled = value; }
    form.addEventListener('submit', async event => {
      event.preventDefault(); error.textContent = '';
      let item;
      try { item = core.item({id: existing.id || crypto.randomUUID(), ...Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value])), ...images}); }
      catch (failure) { error.textContent = failure.message; return; }
      setBusy(true);
      try { await save({action: 'save', item}); setBusy(false); showList(); }
      catch (failure) { error.textContent = failure.message; setBusy(false); }
    });
    if (existing.id) form.append(button('Remove shortcut', 'remove', async () => {
      setBusy(true); error.textContent = '';
      try { await save({action: 'remove', id: existing.id}); setBusy(false); showList(); }
      catch (failure) { error.textContent = failure.message; setBusy(false); }
    }));
    body.append(form);
  }
  chrome.storage.local.get(core.KEY).then(value => { items = core.read(value[core.KEY]); revision++; reconcile(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[core.KEY]) return;
    items = core.read(changes[core.KEY].newValue); revision++; reconcile();
    if (dialog?.open && !busy && !body.querySelector('form')) showList();
  });
  // Only two known host lookups; no scroll listener or timeline subtree observer.
  setInterval(reconcile, 500);
})();
