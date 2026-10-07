# SIFI X Focus

Following by default, one video at a time, and finite Home and reply pages. Separate from SIFI X Ad Blocker.

- Home selects Following each time you enter it.
- Fullscreen videos block touch swipes, wheel scrolling, navigation keys, automatic next playback and next-video route changes. Exit/back and seeking remain available.
- Home shows 10 posts per page, up to 6 pages / 60 posts per feed. Following and For You retain separate page positions. There is no automatic next page.
- Replies show 10 per page, up to 6 pages / 60 replies per conversation.
- Forward navigation pauses for 1.5 seconds; backward navigation is immediate when cached.
- Page changes use in-place rendering and authenticated fetching from X, never a document reload. Current posts or replies remain visible during the pause, and buttons are disabled until the change completes.
- The pager follows the last reply directly, with thumb-sized numbered buttons and Previous/Next. Padding after the pager reserves room for X’s native toolbar.

Replies use a lightweight reader with author links, text, image previews, quotes and an **Open reply** link to the original conversation for X’s full reply/reaction controls. Open reply marks that one thread for a native view, so its API response is left intact; normal pagination resumes on other posts. The original post and native composer stay in X’s own interface. No engagement is sent automatically.

## Implementation

Content scripts run at document start in the main world. The extension intercepts only same-origin `TweetDetail`, `HomeLatestTimeline`, and `HomeTimeline` reads (GET or POST), including prefetches, using X’s existing requests. It captures their authentication headers in memory only and reuses them solely for additional feed batches on the same X origin.

Native Home rows and pagination cursors are removed; the finite reader owns those posts while keeping X’s native header, feed tabs and navigation. Reposts retain their attribution, and promoted posts are excluded. Home cards link to the original post for its native reply/reaction controls.

The native reply response is reduced to the original post/context and has its bottom cursor removed. X never receives an infinite reply timeline. A separate ordinary-flow list renders at most ten comments and avoids native reply virtualization altogether. Only the small original-post shell is measured to remove X’s empty reserved tail; page changes preserve its element and height.

At most two recent thread sessions and the two Home feeds are retained in memory, capped at 60 items each. No comments or authentication data are written to storage. No comment prefetching happens during scrolling. The reader installs no scroll or touch listener and no document-wide mutation observer. Resize observers watch only the native toolbar and original-post shell. Leaving the route aborts an in-flight page fetch and removes the reader.

`PAGE_SIZE` and `MAX_PAGES` are in `extension/replies-core.js`; `FORWARD_DELAY` is in `extension/replies.js`. X can change its private API or markup, so these integrations can require updates.

## Development

Load `extension/` unpacked on desktop, or install `dist/sifi-x-focus.crx` in Titanium. Run `npm run check`, `npm test`, and `npm run build:crx`. Keep `.keys/x-focus.pem` private to preserve the installed extension ID.

Tests cover video lock/exit, exact page sizes and cap, nested conversations, organic Home posts, repost attribution, deduplication, cursor removal, unknown payloads, fetch/XHR GET and POST transports, POST cursor body preservation, reused XHR cleanup, prefetched SPA threads, and absence of persistent data. Live Pixel validation confirmed both Home feeds reach page six without reloading, cached backward navigation, unchanged header height, zero gap before pagination, full pager clearance above the native toolbar, and no reader DOM mutations or observed long tasks during repeated scrolling.
