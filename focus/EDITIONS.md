# Home editions

Home keeps X’s native posts, controls, media players, feed tabs and virtualized scrolling. The extension supplies a saved timeline response; it never draws Home cards.

## Reading behavior

- Morning, afternoon and evening windows begin at **08:00, 13:00 and 18:00 in the device’s local timezone**. Before 08:00, the previous evening’s window still applies. Daylight saving changes keep these local hours.
- The first successful Home read in a window saves one native batch, up to **40 organic posts**. X may return fewer. Following and For You have separate editions; Home still defaults to Following.
- Reloads, native refresh attempts, other tabs and browser restarts reuse the saved response. Cached reads do not request a fresh Home timeline.
- Entering Home pins the reading session to that window. Crossing a scheduled time while reading does not change the feed. A subsequent Home visit may capture the next edition.
- If X restores an old Home screen entirely from its SPA cache on a new scheduled visit, a one-time page reload lets X render the new edition. This never runs just because the clock changes while reading, and it does not reload over a draft.
- Bottom and top cursors are terminated. Scrolling reaches a clear ending and never fetches an unlimited older feed. Cursor requests receive an empty terminal response, not duplicated posts.
- A quiet heading shows the edition, post count, save time and next update time. The ending follows the final native post and clears the bottom toolbar. X reserves an empty tail after its feed; the ending is positioned inside that space without changing native card heights or the virtualizer’s height.

## Cache and account boundaries

`editions-core.js` parses and bounds native responses, calculates windows, and applies successful local like/bookmark changes. `editions.js` intercepts only the two same-origin Home GraphQL operations, including mobile XHR POST requests. It uses the existing page request only when capturing a new edition. Other requests use their original transport. Successful native like/bookmark requests are observed to update saved button states; the extension never sends those actions itself.

`editions-bridge.js` runs in the isolated extension world and restricts storage messages to the currently signed-in account. `editions-store.js` owns persistent `chrome.storage.local` data. Authentication headers, cookies and request bodies are never written to storage. Saved timelines may include protected posts visible to that account; the cache stays on this device and is not synced or uploaded.

Web Locks coordinate captures across tabs on the same origin. Serialized writes keep the first completed edition when tabs on different X origins capture concurrently. Older tabs cannot overwrite a newer stored edition. Each account/feed has one saved record; a successful capture for a different account removes the previous account’s records. There is no edition archive or history UI in this version.

A failed refresh retains the last saved edition and labels the failure. Storage or unknown response failures without a usable saved edition show an error rather than silently enabling a live infinite feed. This does not make all of X available offline: media and individual post conversations still use X normally.

## Maintenance and verification

The integration depends on X’s private Home response format and native timeline structure. New formats should be inspected before changing the adapter. Avoid rebuilding cards, overriding Home scroll/touch behavior, or changing virtualizer heights.

Run `npm run check`, `npm test`, and `npm run build:crx` from the stack root. Automated coverage includes scheduling and DST, native payload preservation, the post cap, cursor termination, persistent replay, concurrent captures, account separation, offline fallback, XHR JSON/text responses and reuse, aborts, reaction-state persistence and storage validation. Existing video and reply tests run alongside these.

Pixel validation compared all 39 posts in an actual Following edition across reloads: the post-order SHA-256 stayed identical and subsequent reads made zero Home timeline requests. Native reply, like, menu and video controls remained present. No post or engagement action was published during verification.
