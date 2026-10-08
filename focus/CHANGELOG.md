# Changelog

## 0.6.7

- Apply the Following default only once per document, on its first Home visit. Returning from a post, rebuilding the tab strip, or navigating within X no longer forces For You back to Following. Native feed/scroll restoration remains in X’s control.
- Add regression coverage for post Back navigation, tab remounts, delayed loading and fresh-document defaults.

## 0.6.6

- Add a Mochi app preset beside Gmail, using its verified browser launch link. Switching presets updates automatically filled names/icons while preserving custom values.

## 0.6.5

- Fix Gmail shortcuts when the app is fully closed: target its general deep-link entry point instead of the label handler, which starts and then exits on a cold launch.
- Upgrade previously generated Gmail preset URLs when loading shortcuts, preserving titles, icons and descriptions. Custom label links remain unchanged.
- Verify native Gmail stays open after launching from a real browser tap following force-stop.

## 0.6.4

- Accept Android app-opening intent links as shortcut destinations while keeping image URLs restricted to web/image sources.
- Add a Gmail app preset using its direct inbox link, verified by a browser touch launching the native Gmail activity. App links use direct user-activated anchors; no companion app or extra extension permissions.

## 0.6.2

- Stop changing page overflow when opening the shortcut editor; the native modal contains its own scrolling without resetting the virtualized Home feed.

## 0.6.1

- Fix unresponsive end-of-edition shortcuts and their add/edit control: the native timeline’s transparent tail intercepted taps above the footer. Give the footer its own low stacking layer without changing native feed dimensions or spacing.

## 0.6.0

- Shorten cosmetic pull-to-refresh loading to 900 ms.
- Add saved destination shortcuts beside reply pagination and larger cards above the end-of-edition message.
- Include a touch-friendly editor for links, emoji or image icons, optional descriptions and posters. Navigate in the current tab to leave X.
- Persist the shared list locally across reloads, browser restarts and updates; serialize changes from different tabs. No additional permissions.

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
