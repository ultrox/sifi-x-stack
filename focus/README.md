# SIFI X Focus

Predictable Home editions, Following by default, one video at a time, and deliberate reply pages. Separate from SIFI X Ad Blocker.

- Home selects Following once on the first Home visit after a full page load or hard reload. Returning from posts or other in-app screens keeps your selected feed and lets X restore your reading position.
- Home uses X’s native feed with saved editions: up to 40 posts, refreshed on your next visit after 08:00, 13:00 or 18:00 local time. Reloading reuses the current edition. Following and For You keep separate saved batches.
- Pull down at the top for a 900 ms cosmetic loading animation; the saved edition stays exactly as it was.
- A quiet edition heading and ending mark a finite feed; the active reading session never refreshes because the clock crosses an update window. See [Home editions](EDITIONS.md) for cache behavior, storage boundaries and maintenance.
- Fullscreen videos block touch swipes, wheel scrolling, navigation keys, automatic next playback and next-video route changes. Exit/back and seeking remain available.
- Replies show 10 per page, up to 6 pages / 60 replies per conversation.
- Forward navigation pauses for 1.5 seconds; backward navigation is immediate when cached.
- Page changes use in-place rendering and authenticated fetching from X, never a document reload. Current replies remain visible during the pause, and buttons are disabled until the change completes.
- The pager follows the last reply directly, with thumb-sized numbered buttons and Previous/Next. Padding after the pager reserves room for X’s native toolbar.

Replies use a lightweight reader with author links, text, image previews, quotes and an **Open reply** link to the original conversation for X’s full reply/reaction controls. Open reply marks that one thread for a native view, so its API response is left intact; normal pagination resumes on other posts. The original post and native composer stay in X’s own interface. No engagement is sent automatically.

## Your shortcuts

Tap **+** beside Previous/Next on a reply page, or in **A place to go next** above the edition ending. Add a title, website address and emoji. **Custom icon & poster** also accepts image URLs or images from your device; uploads are resized locally. A description and poster are optional.

For an installed Android app, paste its `intent://…#Intent;…;end` link into **Website or Android app link**. **Use Gmail app** and **Use Mochi app** fill the app link and title/icon; save normally. Custom titles/icons are preserved when switching presets. Android handles the app switch on a tap. The destination app must support that link. Gmail uses its general deep-link entry point, tested after force-stop; older generated Gmail preset links are upgraded automatically when loaded.

Tap **Save shortcut**. The same saved list powers the compact buttons and larger cards. Links open in the current tab so you leave X. Use **+ → Edit** to change or remove a destination; the manager lists every saved link. On a phone the pager shows the first shortcut plus **+**; wider screens show two shortcuts. The edition ending shows all cards.

Up to 20 destinations are saved in extension-local storage, independently of edition refreshes and account changes. They survive tab reloads, browser restarts and extension updates. They are not synced to other devices, and uninstalling the extension removes them. Remote image URLs are requested from their hosts without a referrer; uploaded images remain local.

## Implementation

Content scripts run at document start in the main world. The reply reader intercepts only same-origin `TweetDetail` reads, including prefetches, using X’s existing requests. It captures their authentication headers in memory only and reuses them solely for additional reply batches on the same X origin.

The native reply response is reduced to the original post/context and has its bottom cursor removed. X never receives an infinite reply timeline. A separate ordinary-flow list renders at most ten comments and avoids native reply virtualization altogether. Only the small original-post shell is measured to remove X’s empty reserved tail; page changes preserve its element and height.

At most two recent thread sessions are retained in memory, capped at 60 replies each. No reply-reader comments or authentication data are written to storage. Home editions store their native timeline responses locally, as described in [Home editions](EDITIONS.md). No comment prefetching happens during scrolling. The reader installs no scroll or touch listener and no document-wide mutation observer. Resize observers watch only the native toolbar and original-post shell. Leaving the route aborts an in-flight page fetch and removes the reader.

`PAGE_SIZE` and `MAX_PAGES` are in `extension/replies-core.js`; `FORWARD_DELAY` is in `extension/replies.js`. X can change its private API or markup, so these integrations can require updates.

## Development

Load `extension/` unpacked on desktop, or install `dist/sifi-x-focus.crx` in Titanium. Run `npm run check`, `npm test`, and `npm run build:crx`. Keep `.keys/x-focus.pem` private to preserve the installed extension ID.

Tests cover video lock/exit, exact page sizes and cap, nested conversations, deduplication, cursor removal, unknown payloads, fetch/XHR transports, reused XHR cleanup, prefetched SPA threads, and absence of persistent data. Live Pixel validation confirmed in-place page switches, unchanged original-post height, zero gap before pagination, full pager clearance above the native toolbar, and no reply DOM mutations or observed long tasks during repeated scrolling.

Shortcut tests cover URL and image validation, list limits, concurrent edits, worker restarts, and independence from edition/account cleanup. Pixel validation confirmed image upload/resizing, reload persistence, editing/removal, same-tab navigation, unchanged in-place reply paging, and 46 px controls fully above the native toolbar with no horizontal overflow.

For Android hit-testing regressions, open a dedicated Home tab with a saved shortcut and run `node scripts/editions-touch-check.cjs ws://127.0.0.1:PORT/devtools/page/TARGET` from `focus/`. This uses real touch events to check the footer manager, Edit/Add forms, card activation and toolbar layering. It prevents the test card navigation and never modifies stored settings. DOM `.click()` alone cannot detect a transparent timeline covering a visible control.
