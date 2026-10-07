const assert = require('node:assert/strict');
const core = require('../extension/replies-core.js');
const tweet = (id, parent) => ({tweet_results:{result:{__typename:'Tweet',rest_id:String(id),legacy:{...(parent?{in_reply_to_status_id_str:String(parent)}:{}),full_text:'Fixture reply'}}}});
const direct = id => ({entryId:`tweet-${id}`,content:{entryType:'TimelineTimelineItem',itemContent:tweet(id)}});
const moduleEntry = (index,count=3) => ({entryId:`conversationthread-${index}`,content:{entryType:'TimelineTimelineModule',displayType:'VerticalConversation',metadata:{conversationMetadata:{allTweetIds:[]}},items:Array.from({length:count},(_,i)=>({entryId:`conversationthread-${index}-tweet-${index*10+i}`,item:{itemContent:tweet(index*10+i,'100')}}))}});
const data = {data:{threaded_conversation_with_injections_v2:{instructions:[{type:'TimelineAddEntries',entries:[direct(99),direct(100),...Array.from({length:30},(_,i)=>moduleEntry(i+20)),{entryId:'tweetdetailrelatedtweets-1',content:moduleEntry(300).content},{entryId:'cursor-bottom-1',content:{entryType:'TimelineTimelineCursor',cursorType:'Bottom',value:'NEXT'}}]}]}}};
const before = JSON.stringify(data);
const parsed = core.read(data,'100');
assert.ok(parsed.valid);assert.equal(parsed.context.length,2);assert.equal(parsed.replies.length,90);assert.equal(parsed.cursor,'NEXT');
const cached = core.merge([],parsed.replies);assert.equal(cached.length,60);assert.equal(core.merge(cached,parsed.replies).length,60);
for(let page=1;page<=6;page++) {
 const shaped=core.shape(data,parsed.context,cached,page);
 const read=core.read(shaped,'100');
 assert.equal(read.replies.length,10);
 assert.deepEqual(read.replies.map(r=>r.id),cached.slice((page-1)*10,page*10).map(r=>r.id));
 assert.equal(read.cursor,null);
 assert.equal(core.timeline(shaped).instructions.at(-1).direction,'Bottom');
 const entries=core.timeline(shaped).instructions.flatMap(i=>i.entries||[]);
 assert.ok(!entries.some(e=>e.entryId.startsWith('tweetdetailrelatedtweets')));
 assert.ok(entries.filter(e=>e.content.items).every(e=>!e.content.metadata));
}
assert.equal(JSON.stringify(data),before,'Source API payload remains untouched');
const noReplies=core.read({data:{threaded_conversation_with_injections_v2:{instructions:[{type:'TimelineAddEntries',entries:[direct(100)]}]}}},'100');assert.equal(noReplies.replies.length,0);
assert.equal(core.read({data:{}},'100').valid,false);assert.equal(core.shape({data:{}},[],[],1),null);
const wrapped=moduleEntry(500,1);const raw=wrapped.content.items[0].item.itemContent.tweet_results.result;wrapped.content.items[0].item.itemContent.tweet_results.result={__typename:'TweetWithVisibilityResults',tweet:raw};assert.equal(core.read({data:{threaded_conversation_with_injections_v2:{instructions:[{entries:[direct(100),wrapped]}]}}},'100').replies.length,1);
console.log('Reply paging: nested threads, exact 10/page, six-page cap, deduplication, no cursor/recommendations, wrapped tweets, unknown layouts, and immutable source passed.');
