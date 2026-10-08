# SIFI X Stack

Two independent extensions for X/Twitter, maintained together:

- **SIFI X Ad Blocker** (`ads/`): hides promoted feed posts and ad banners.
- **SIFI X Focus** (`focus/`): provides saved native Home editions on a morning/afternoon/evening schedule, defaults to Following, and locks fullscreen viewing to one video. Exit to choose another; no swipe feed or automatic next clip. Replies load in place, ten per page, with a six-page limit and a short pause before moving forward. Saved shortcuts offer a place to go next from reply controls and the edition ending.

Install either extension or both. Each keeps its own package and signing key, so updates preserve the existing installed extension IDs.

Run `npm run check`, `npm test`, `npm run build`, or `npm run build:crx` from this directory. Unsigned ZIPs and signed CRXs are written to each extension’s `dist/` folder. Load `ads/extension/` and `focus/extension/` unpacked for desktop development.

Private signing keys and generated packages are excluded from Git.
