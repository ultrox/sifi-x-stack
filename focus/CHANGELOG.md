# Changelog

## 0.5.5

- Add a cosmetic pull-to-refresh loader at the top of a saved Home edition.
- Show “Loading…” for 1.6 seconds, then return to the unchanged feed without requests, cache refreshes or document reloads.
- Keep normal scrolling, horizontal gestures, video controls and dialogs outside the gesture handler.

## 0.5.4

- Add saved native Home editions at 08:00, 13:00 and 18:00 local time, with up to 40 posts per feed.
- Reuse the same edition across reloads, tabs and browser restarts; keep active reading sessions stable across schedule boundaries.
- Preserve X’s native post rendering, controls and virtual scrolling, with a compact edition heading and clear ending.
- Keep editions separate by account and feed; retain only the latest snapshots on this device.
- Preserve saved like/bookmark states after successful native actions and retain the last edition if a refresh fails.

## 0.4.2

- Remove Home pagination and restore X’s native Home feed.
- Keep existing reply pagination, Following by default, and video restrictions.

## 0.3.2

- Open reply uses a native X thread, bypassing pagination for that specific reply.
- Preserve the native view if X removes the query marker; resume pagination on other posts.

## 0.3.1

- Add in-place reply pagination: 10 replies per page, 6 pages maximum.
- Add a 1.5-second forward pause; keep cached backward navigation immediate.
- Render bounded reply cards outside X’s comment virtualizer while retaining the native original post and composer.
- Place thumb-sized pagination directly below the last reply, above reserved toolbar space.
- Reserve media dimensions before image loading and cancel pending requests on route changes.

## 0.1.0

- Default Home to Following and block fullscreen video swipes / automatic next clips.
