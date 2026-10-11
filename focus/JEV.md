# JEV qualification contract

Version: `world-tech-entertainment-v2`.
Canonical request and validation: `extension/jev-core.js`.
Provider: https://docs.typesafe.ai/api (`jev-latest`, typed Choice questions).

The aim is to keep concrete world and technology developments, useful explanations,
and worthwhile entertainment, while marking attention bait. Negative news, strong
emotion, criticism and political disagreement are not grounds for rejection.
Entertainment is valuable in its own right.

The five questions classify category, value, dominant attention tactic, suggested
verdict, and whether the supplied context is sufficient. The provider returns
choices, probabilities and confidence. The explanation is a short rubric label,
not a fabricated free-text quotation from JEV. Missing context or verdict
confidence below 0.65 results in a blue context/uncertainty badge; attention flags
use orange. Confidence is model uncertainty,
not factual verification. A post is never automatically hidden or replaced.

Text, quoted text, media type, supplied alt descriptions, and the author’s display
name and @handle are sent. Quoted authors are included when available. Names provide
speaker context, not evidence of accuracy or quality. No image/video files, linked
pages, signed-in account identifiers, post IDs, engagement counts or browser
credentials are sent. Protected posts and protected quoted text/identity are excluded
when marked as such in the saved response. Classification
uses the stored For you edition, not arbitrary text supplied by a page message.

## Persistent cache

Cache identity is account + post ID. There is no expiry. Another edition, edited
text, changed contract version, scroll remount, reload or worker/browser restart
does not automatically invoke JEV again. The result retains its contract/model
version so the original assessment remains identifiable.

Requests are serialized and duplicates share one job. A durable attempt marker
is written before dispatch. If the process dies or a response is lost, the attempt
is displayed as unavailable instead of automatically incurring another call.
Failures are cached too. There is no automatic retry. Explicit Reassess posts replaces cached attempts.
Deleting extension data/uninstalling removes the cache and its guarantees.

“Wrong assessment” records a local Keep / Flag / Consider hiding correction.
It does not send feedback to JEV, retrain a model, or start another request.

## Configuration and testing

Open X Focus settings, enter your TypeSafe key, enable assessments and save.
JEV is disabled until configured. Credentials are stored separately from public
settings and are never placed in X's MAIN-world scripts or bundled builds.
The extension's only additional host permission is `https://api.typesafe.ai/*`.

`npm test` covers contracts, protected content, deduplication, persistent reuse,
interruptions, error redaction and local correction. `node scripts/jev-live-test.cjs`
is an explicitly invoked paid-provider smoke test using three fictional posts.
It reads `TYPESAFE_API_KEY` from the repository's ignored `.dev.vars`. Test outcomes
and attempt markers are cached in ignored `dist/jev-fixture-results.json`, so
re-running the test does not repeat the calls.

Prior v1 live smoke test: JEV identified tech news (flagged due to verdict uncertainty),
engagement bait (consider hiding), and a standalone joke (keep). UI interaction
was verified in a local fixture using the real cached joke assessment. Device
installation and live X rendering remain pending.

## Manual classification (0.7.1)

The For you timeline now has a **Classify posts** control above the edition.
Loading a feed displays cached labels but makes no provider calls. Clicking the
button processes unassessed posts in the current saved edition, including cards
not currently mounted by X. Counts and progress are shown inline. Cached results,
failures and interrupted attempts are reused during normal classification. At completion
the button becomes **Reassess posts**. Clicking it explicitly requests fresh assessments
for the current edition, replacing cached results, errors, logs and local corrections.
It stays disabled while running to avoid duplicate clicks. Reloading never reassesses. The API key remains in extension settings.

## Badge layout regression

Serve the `focus` directory locally and open `/scripts/fixtures/jev-flex.html`.
The fixture uses fictional posts, cached assessments and a mocked extension API;
it makes no provider calls. Its nested flex columns sit inside fixed-height cells.
Collapsed badges should measure about 46–63 pixels and all text/actions should
remain inside their cells. The former `flex-basis: 100%` makes each badge 335 pixels
and pushes the post text outside the cell. Test both 390px and 600px feed widths.

## Exchange log (0.7.4)

Expand a badge and select Log to inspect the saved request JSON (including all
questions/instructions), response body, timestamp and HTTP status. The normalized
assessment and any local correction are shown separately. Authorization headers
are never saved, and literal API-key echoes in response bodies are redacted.
Requests are recorded before dispatch; missing responses are identified honestly.
Older cache entries have no exchange log and are never reconstructed. An explicit
Reassess posts click produces a fresh assessment with its own exchange log.
Viewing a log makes no provider call. Logs persist with the cached assessment.
