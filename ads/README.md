# SIFI X Ad Blocker

A separate Chromium Manifest V3 extension for Titanium on Android and desktop Chromium.
Hides promoted timeline cells and advertising banners on X/Twitter. Ordinary posts and videos remain visible. No background process, JavaScript scroll observers, network interception, or additional permissions.

Load `extension/` unpacked on desktop. Run `npm run build` for a ZIP, or `npm run build:crx` for a signed Titanium package. Keep the private `.keys/x-ads.pem` key for updates; never publish it.

Uses X’s current DOM ad markers. It hides ad presentation rather than preventing all ad requests; changes to X’s markup may require updated filters. It does not claim to block video pre-roll ads.

Structural marker reference: https://github.com/alixaprodev/x_mate . Implementation uses native CSS matching to distinguish ad tracking outside articles from ordinary video wrappers inside them.
