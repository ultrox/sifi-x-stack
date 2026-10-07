# SIFI X Focus

Separate from SIFI X Ad Blocker. Defaults Home to Following each time you enter it. Locks X’s fullscreen video viewer to the clip you opened: touch swipes, wheel scrolling, navigation keys, automatic next-video playback and next-video route changes are blocked. Exit/back and video seeking remain available.

Load `extension/` unpacked on desktop, or install `dist/sifi-x-focus.crx` in Titanium. `npm run check`, `npm test`, `npm run build:crx`. Keep `.keys/x-focus.pem` private for stable updates. No additional permissions or network requests.

X can change its viewer markup; the current lock targets `vss-scroll-view`, `/mediaViewer`, and `/video/N` routes.
