# TubeShield

> Ultra-light YouTube-only ad blocker — Manifest V3

TubeShield is a focused, minimal Chrome extension that blocks ads across YouTube (desktop). It is heavily inspired by [uBlock Origin](https://github.com/gorhill/uBlock) (uBO) and adapts several of uBO's filtering techniques — including scriptlet-based `json-prune`, response interception, and cosmetic filtering — into a lightweight Manifest V3 extension purpose-built for YouTube.

> **Developed by uBlock Origin × Tarek** — full credit to Raymond Hill and the uBlock Origin project for the filtering methodology and scriptlet patterns that this extension builds upon.

## Features

- **Network-level blocking** — blocks ad-serving domains via `declarativeNetRequest`
- **JSON response pruning** — intercepts `fetch`/`XHR` responses and strips ad placements (`adPlacements`, `playerAds`, `adSlots`) from YouTube API payloads
- **JavaScript object trapping** — nullifies ad properties on `ytInitialPlayerResponse` and `ytInitialData`
- **Skip button automation** — automatically clicks YouTube's skip button and fast-forwards through unskippable ads
- **Ad element removal** — scans and removes ad DOM elements (`ytd-ad-slot-renderer`, etc.) continuously
- **Cosmetic filtering** — CSS-based hiding of ad containers (adapted from EasyList/uAssets)
- **Ad-blocker detection circumvention** — intercepts `Promise.prototype.then` to neutralize YouTube's ad-blocker detection callbacks
- **On-screen widget** — shows live ad count and toggle in a draggable overlay
- **Badge counter** — extension toolbar badge displays total blocked count
- **Popup controls** — enable/disable toggle, reset counter

## Installation

1. Clone or download this repo
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the `TubeShield` folder

## Permissions

| Permission | Why |
|---|---|
| `declarativeNetRequest` | Block ad network requests |
| `declarativeNetRequestFeedback` | Count blocked requests |
| `storage` | Save toggle state & blocked count |
| Host permissions (`youtube.com`, `googlevideo.com`, `doubleclick.net`, etc.) | Apply blocking on YouTube and ad domains |

## How it works

TubeShield uses a multi-layer defense:

1. **`rules.json`** — 14 declarative net rules block known YouTube ad endpoints (`pagead2.googlesyndication.com`, `googleads.g.doubleclick.net`, `youtube.com/api/stats/ads`, etc.)
2. **`inject.js`** (MAIN world) — runs inside YouTube's page context and:
   - Overrides `JSON.parse` to strip ad data from parsed objects
   - Intercepts `fetch` and `XMLHttpRequest` responses to prune ad placements from YouTube API responses (`/youtubei/v1/player`, `/youtubei/v1/next`, etc.)
   - Traps `ytInitialPlayerResponse` and `ytInitialData` to delete ad-related properties
   - Neutres YouTube's ad-block detection via `Promise.prototype.then` proxy
3. **`content.js`** (ISOLATED world) — handles:
   - Auto-skipping video ads by clicking skip buttons and seeking to end
   - Scanning for ad DOM elements and bumping counter
   - On-screen widget with real-time toggle and count
   - Removing anti-adblock enforcement dialogs
4. **`hide.css`** — hides 50+ YouTube ad selectors (adapted from EasyList/uAssets)

## Credits

- **[uBlock Origin](https://github.com/gorhill/uBlock)** by Raymond Hill — the gold standard for content blocking. TubeShield's `json-prune`, response interception, and cosmetic filter patterns are directly adapted from uBO's scriptlet and filter methodology.
- **[EasyList](https://easylist.to/)** / **[uAssets](https://github.com/uBlockOrigin/uAssets)** — the community-maintained filter lists that provide the cosmetic filter rules used in `hide.css`.

## License

[MIT](LICENSE)
