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

## 0.6.8

- Cap For you editions at 18 posts, including older saved editions on replay.
- Add a compact options popup with a persistent 1–18 post limit.
- Keep Following at its existing limit.
- Reserve an explicitly unconfigured JEV section pending its qualification contract.

## 0.7.0

- Add optional JEV qualification labels for saved For you posts, with local verdict corrections.
- Add TypeSafe key and enable controls; keep the 18-post cap and labels-only behavior.
- Persist assessments and attempts without expiry; never automatically rerate or retry.
- Assess text and media descriptions against a versioned world/tech/entertainment contract.

## 0.7.1

- Switch classification to an explicit in-feed Classify posts button, with cached/new counts and progress.
- Restore cached labels without network calls; never classify because a card was scrolled into view.
- Add the warm orange/charcoal icon variant to toolbar and settings.

## 0.7.2

- Include author display names and handles, including quoted authors, in new JEV assessments.
- Move assessment badges into their own row above post content, with clear titles and light/dark styling.
- Distinguish blue missing-context/uncertainty notices from orange attention flags.
- Preserve existing cached assessments without additional provider calls.

## 0.7.3

- Fix JEV badges taking a full post height inside X’s flex columns, which caused gaps and clipped content.
- Add a nested, fixed-height flex layout fixture to reproduce the sizing regression.

## 0.7.4

- Add Assessment / Log tabs inside expanded JEV badges.
- Persist request JSON, response body, HTTP status and timestamps for new assessments, excluding authorization headers.
- Show old-cache log unavailability without reclassifying posts.

## 0.7.5

- Replace disabled All assessed with an active Reassess posts action.
- Explicit reassessment replaces current-edition results and logs, including cached failures and corrections; ordinary reloads keep using the cache.
- Show progress for fresh assessments and deduplicate concurrent reassessment requests.

## 0.7.6

- Use neutral “Text alone isn’t enough” and “Low confidence · N%” labels for assessment limitations.
- Explain JEV’s original verdict, the unvalidated local 65% cutoff, local verdict changes, available inputs and user overrides.
- Identify rubric explanations as extension wording rather than model quotations; existing cached results need no new requests.

## 0.7.7

- Block automatic video playback across X, including muted feed previews.
- Require a trusted click or keyboard activation on the specific player; revoke permission after pause, end or source changes.
- Remove autoplay/loop attributes from newly inserted videos and retain existing fullscreen next-video restrictions.

## 0.7.8

- Keep topic classification visible and replace large verdict/confidence labels with a small colored information icon.
- Use amber for low verdict confidence (<65%), blue for medium (65–84%), and purple for high (85%+), with dark theme variants.
- Explain levels and percentages on expansion and through accessible labels/tooltips, separately from factual accuracy.

## 0.8.0

- Add optional pagination for For you and Following, independently enabled in settings.
- Limit pages to 1–10 posts (default 10), counting nested conversation posts.
- Serve slices of the saved edition through X’s native timeline refresh without fetching new posts or replacing native cards.
- Add numbered, Previous and Next controls to the ordinary-flow edition footer, retaining toolbar clearance.
- Keep the complete saved edition and page position per feed in the document; new editions start at page one.
- If X does not request a refreshed timeline, keep the selected page unchanged and show an error instead of reloading.

## 0.8.1

- Stop clicking the selected Following tab, which opens X’s sort menu.
- Request page changes through the native Home control without an explicit preemptive scroll.
- Allow a pending page change to consume a cursor-based refresh response; ordinary continuation requests still terminate.
- Update the integration fixture so selected tabs open a menu and Home refresh includes a cursor. Live verification pending.

## 0.8.2

- Remove feed pagination, its settings, page slicing and native navigation triggers.
- Restore full saved editions in both Home feeds; preserve comment pagination, JEV and autoplay blocking.
