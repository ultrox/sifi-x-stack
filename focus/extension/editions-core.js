/* Data and schedule only. X renders every post in an edition. */
((root, factory) => {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SifiEditions = factory();
})(globalThis, () => {
  const SCHEMA = 1;
  const LIMIT = 40;
  const HOURS = [8, 13, 18];
  const LABELS = ['Morning', 'Afternoon', 'Evening'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const timeline = data => data?.data?.home?.home_timeline_urt || data?.data?.home?.home_timeline;
  function windowAt(now = Date.now()) {
    const date = new Date(now);
    let index = HOURS.findLastIndex(hour => hour <= date.getHours());
    if (index < 0) { date.setDate(date.getDate() - 1); index = 2; }
    date.setHours(HOURS[index], 0, 0, 0);
    const next = new Date(date);
    if (index === 2) next.setDate(next.getDate() + 1);
    next.setHours(HOURS[(index + 1) % 3], 0, 0, 0);
    return { id:String(date.getTime()), startsAt:date.getTime(), nextAt:next.getTime(), label:LABELS[index] };
  }
  function operation(value, origin) {
    try {
      const url = new URL(value, origin);
      if (url.origin !== origin || !/^\/i\/api\/graphql\/[^/]+\//.test(url.pathname)) return null;
      const name = url.pathname.split('/').pop();
      return name === 'HomeLatestTimeline' ? 'following' : name === 'HomeTimeline' ? 'for-you' : null;
    } catch { return null; }
  }
  function tweet(item) {
    const result = item?.tweet_results?.result;
    return result?.tweet || result;
  }
  function freeze(data) {
    const view = clone(data);
    const target = timeline(view);
    if (!Array.isArray(target?.instructions)) throw new Error('Unrecognized Home response');
    const entries = target.instructions.flatMap(i => i.entries || (i.entry ? [i.entry] : []));
    const kept = [];
    const seen = new Set();
    function keep(item) {
      const value = tweet(item);
      if (!value?.rest_id || !value.legacy || item.promotedMetadata || seen.has(value.rest_id) || seen.size >= LIMIT) return false;
      seen.add(value.rest_id);
      return true;
    }
    for (const entry of entries) {
      if (entry.entryId?.startsWith('promoted-')) continue;
      const content = entry.content;
      if (!content || content.cursorType) continue;
      if (content.itemContent && keep(content.itemContent)) kept.push(entry);
      else if (content.items) {
        content.items = content.items.filter(item => keep(item.item?.itemContent));
        if (content.items.length) {
          // Retain X's conversation module and its own native cards, but no expansion cursor.
          delete content.showMore;
          delete content.metadata;
          kept.push(entry);
        }
      }
    }
    target.instructions = [
      {type:'TimelineClearCache'},
      {type:'TimelineAddEntries', entries:kept},
      {type:'TimelineTerminateTimeline', direction:'Top'},
      {type:'TimelineTerminateTimeline', direction:'Bottom'},
    ];
    return { payload:view, count:seen.size };
  }
  function empty(data) {
    const view = clone(data);
    const target = timeline(view);
    target.instructions = [
      {type:'TimelineTerminateTimeline', direction:'Top'},
      {type:'TimelineTerminateTimeline', direction:'Bottom'},
    ];
    return view;
  }
  function request(urlValue, init = {}) {
    const url = new URL(urlValue);
    const next = {...init};
    if (String(init.method || 'GET').toUpperCase() === 'POST') {
      const body = JSON.parse(init.body);
      body.variables = {...body.variables, count:LIMIT};
      delete body.variables.cursor;
      delete body.variables.seenTweetIds;
      next.body = JSON.stringify(body);
    } else {
      const variables = JSON.parse(url.searchParams.get('variables') || '{}');
      variables.count = LIMIT;
      delete variables.cursor;
      delete variables.seenTweetIds;
      url.searchParams.set('variables', JSON.stringify(variables));
    }
    return {url:url.href, init:next};
  }
  function hasCursor(urlValue, init = {}) {
    try {
      const variables = String(init.method || 'GET').toUpperCase() === 'POST'
        ? JSON.parse(init.body).variables : JSON.parse(new URL(urlValue).searchParams.get('variables') || '{}');
      return !!variables?.cursor;
    } catch { return false; }
  }
  function lastTweetId(data) {
    const entries = (timeline(data)?.instructions || []).flatMap(i => i.entries || []);
    const last = entries.at(-1)?.content;
    const value = tweet(last?.itemContent || last?.items?.at(-1)?.item?.itemContent);
    const repost = value?.legacy?.retweeted_status_result?.result || value?.retweeted_status_result?.result;
    return (repost?.tweet || repost || value)?.rest_id;
  }
  function reaction(urlValue, body, origin) {
    try {
      const url = new URL(urlValue, origin);
      if (url.origin !== origin || !/^\/i\/api\/graphql\/[^/]+\//.test(url.pathname)) return null;
      const actions = {FavoriteTweet:['favorited',true],UnfavoriteTweet:['favorited',false],CreateBookmark:['bookmarked',true],DeleteBookmark:['bookmarked',false]};
      const action = actions[url.pathname.split('/').pop()];
      const variables = body ? JSON.parse(body).variables : JSON.parse(url.searchParams.get('variables') || '{}');
      if (!action || !/^\d+$/.test(variables?.tweet_id)) return null;
      return {tweetId:variables.tweet_id, field:action[0], enabled:action[1]};
    } catch { return null; }
  }
  function applyReaction(record, change) {
    if (!['favorited','bookmarked'].includes(change?.field) || typeof change.enabled !== 'boolean' || !/^\d+$/.test(change.tweetId)) return record;
    const result = clone(record);
    function walk(value) {
      if (!value || typeof value !== 'object') return;
      if (value.rest_id === change.tweetId && value.legacy) {
        const previous = !!value.legacy[change.field];
        value.legacy[change.field] = change.enabled;
        if (change.field === 'favorited' && previous !== change.enabled && Number.isFinite(value.legacy.favorite_count)) {
          value.legacy.favorite_count = Math.max(0,value.legacy.favorite_count + (change.enabled ? 1 : -1));
        }
      }
      for (const child of Object.values(value)) if (child && typeof child === 'object') walk(child);
    }
    walk(result.payload);
    return result;
  }
  function valid(record, account, feed) {
    return record?.schema === SCHEMA && record.account === account && record.feed === feed &&
      /^\d+$/.test(record.edition) && Number.isFinite(record.capturedAt) && Number.isFinite(record.nextAt) &&
      record.count >= 0 && record.count <= LIMIT && Array.isArray(timeline(record.payload)?.instructions);
  }
  return {SCHEMA, LIMIT, windowAt, operation, freeze, empty, request, hasCursor, valid, lastTweetId, reaction, applyReaction};
});
