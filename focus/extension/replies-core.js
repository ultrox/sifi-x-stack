/* Pure response shaping: X owns the cards and their virtualized layout. */
((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SifiReplyPages = factory();
})(globalThis, () => {
  const PAGE_SIZE = 10;
  const MAX_PAGES = 6;
  const MAX_REPLIES = PAGE_SIZE * MAX_PAGES;
  const clone = value => JSON.parse(JSON.stringify(value));
  function timeline(data) {
    return data?.data?.threaded_conversation_with_injections_v2 || data?.data?.threaded_conversation_with_injections;
  }
  function tweet(item) {
    const result = item?.tweet_results?.result;
    return result?.tweet || result;
  }
  function entries(data) {
    return (timeline(data)?.instructions || []).flatMap(i => i.entries || (i.entry ? [i.entry] : []));
  }
  function read(data, focalId) {
    const rows = entries(data);
    const context = [];
    const replies = [];
    let focalSeen = false;
    let cursor = null;
    for (const entry of rows) {
      const content = entry.content;
      if (!content) continue;
      if (content.cursorType === 'Bottom') { cursor = content.value; continue; }
      const direct = tweet(content.itemContent);
      if (direct?.rest_id === focalId) {
        context.push(entry);
        focalSeen = true;
        continue;
      }
      if (!focalSeen && direct) { context.push(entry); continue; }
      // Recommended posts, ads and inline "show more" cursors are not replies.
      if (!entry.entryId?.startsWith('conversationthread-')) continue;
      for (const item of content.items || []) {
        const result = tweet(item.item?.itemContent);
        if (!result?.rest_id || result.rest_id === focalId || !result.legacy?.in_reply_to_status_id_str) continue;
        if (item.item?.itemContent?.promotedMetadata) continue;
        replies.push({ id: result.rest_id, entry, item });
      }
    }
    return { context, replies, cursor, valid: focalSeen };
  }
  function merge(previous, incoming) {
    const seen = new Set(previous.map(r => r.id));
    const result = previous.slice(0, MAX_REPLIES);
    for (const row of incoming) {
      if (result.length >= MAX_REPLIES) break;
      if (!seen.has(row.id)) { result.push(row); seen.add(row.id); }
    }
    return result;
  }
  function shape(data, context, replies, page) {
    const view = clone(data);
    const target = timeline(view);
    if (!target) return null;
    const groups = new Map();
    for (const row of replies.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)) {
      if (!groups.has(row.entry.entryId)) {
        const entry = clone(row.entry);
        entry.content.items = [];
        // Module expansion cursors would escape the bounded reader.
        delete entry.content.metadata;
        groups.set(entry.entryId, entry);
      }
      groups.get(row.entry.entryId).content.items.push(clone(row.item));
    }
    target.instructions = [
      { type: 'TimelineClearCache' },
      { type: 'TimelineAddEntries', entries: [...clone(context), ...groups.values()] },
      { type: 'TimelineTerminateTimeline', direction: 'Bottom' },
    ];
    return view;
  }
  return { PAGE_SIZE, MAX_PAGES, MAX_REPLIES, timeline, read, merge, shape };
});
