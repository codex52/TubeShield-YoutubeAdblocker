/* PAGE WORLD — logic adapted from uBO filters/scriptlets (json-prune, set, trusted-replace-*) */
(() => {
  if (window.__ytAbl) return;
  window.__ytAbl = 1;

  let enabled = document.documentElement?.dataset?.ytAbl !== '0';

  window.addEventListener('yt-abl-set', (e) => {
    enabled = e?.detail?.enabled !== false;
  });

  const report = (n = 1) => {
    if (!enabled || n < 1) return;
    try {
      window.dispatchEvent(new CustomEvent('yt-abl-block', { detail: { n } }));
    } catch (_) {}
  };

  const AD_KEYS = new Set([
    'adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams',
    'adPlacementConfig', 'adBreaks', 'adsConfig', 'adParams',
    'adClientParams', 'adSignal', 'adSignalServiceEndpoint',
    'adPlacementRenderer', 'instreamVideoAdRenderer',
    'adSlotRenderer', 'inPlayerAdLayoutRenderer'
  ]);

  const stripAds = (obj, depth = 0) => {
    if (!enabled || !obj || typeof obj !== 'object' || depth > 40) return { obj, n: 0 };
    let n = 0;
    if (Array.isArray(obj)) {
      for (let i = obj.length - 1; i >= 0; i--) {
        const v = obj[i];
        if (v && typeof v === 'object') {
          if (
            v.adPlacementRenderer ||
            v.adSlotRenderer ||
            v.instreamVideoAdRenderer ||
            v.inPlayerAdLayoutRenderer ||
            v.adBreakServiceRenderer ||
            (v.command?.reelWatchEndpoint?.adClientParams?.isAd === true)
          ) {
            obj.splice(i, 1);
            n++;
            continue;
          }
          n += stripAds(v, depth + 1).n;
        }
      }
      return { obj, n };
    }
    for (const k of Object.keys(obj)) {
      if (AD_KEYS.has(k)) {
        if (obj[k] != null) n++;
        delete obj[k];
        continue;
      }
      const v = obj[k];
      if (v && typeof v === 'object') n += stripAds(v, depth + 1).n;
    }
    if (obj.playerResponse) n += stripAds(obj.playerResponse, depth + 1).n;
    return { obj, n };
  };

  const stripAndReport = (o) => {
    const { n } = stripAds(o);
    if (n > 0) report(Math.min(n, 5));
    return o;
  };

  const textStrip = (t) => {
    if (!enabled || typeof t !== 'string' || t.length < 20) return { text: t, hit: false };
    if (!t.includes('adPlacements') && !t.includes('playerAds') && !t.includes('adSlots')) {
      return { text: t, hit: false };
    }
    const out = t
      .replace(/"adPlacements"/g, '"no_ads"')
      .replace(/"playerAds"/g, '"no_ads"')
      .replace(/"adSlots"/g, '"no_ads"');
    return { text: out, hit: out !== t };
  };

  const _parse = JSON.parse;
  JSON.parse = function (text, reviver) {
    const o = _parse.call(this, text, reviver);
    if (enabled) {
      try { stripAndReport(o); } catch (_) {}
    }
    return o;
  };

  const trapUndef = (rootName, props) => {
    let stored;
    Object.defineProperty(window, rootName, {
      configurable: true,
      enumerable: true,
      get() { return stored; },
      set(v) {
        stored = v;
        if (!enabled) return;
        try {
          if (v && typeof v === 'object') {
            let hit = false;
            for (const p of props) {
              if (v[p] != null) hit = true;
              try {
                Object.defineProperty(v, p, {
                  configurable: true,
                  enumerable: true,
                  get() { return undefined; },
                  set() {}
                });
              } catch (_) {
                try { delete v[p]; } catch (__) {}
              }
            }
            stripAndReport(v);
            if (hit) report(1);
          }
        } catch (_) {}
      }
    });
  };

  trapUndef('ytInitialPlayerResponse', ['playerAds', 'adPlacements', 'adSlots']);
  trapUndef('ytInitialData', []);

  try {
    if (window.ytInitialPlayerResponse) stripAndReport(window.ytInitialPlayerResponse);
  } catch (_) {}

  const playerRe = /\/youtubei\/v1\/(player|get_watch|next|reel_watch_sequence)|\/playlist\?list=|\/watch\?/;

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    return origFetch.apply(this, args).then(async (res) => {
      if (!enabled) return res;
      try {
        if (!playerRe.test(url) && !url.includes('player')) return res;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('json') && !ct.includes('javascript') && !ct.includes('text')) return res;
        const text = await res.clone().text();
        const { text: cleaned, hit } = textStrip(text);
        if (!hit) {
          try {
            const j = _parse(text);
            const before = text.includes('adPlacements') || text.includes('adSlots') || text.includes('playerAds');
            stripAndReport(j);
            if (before) report(1);
            return new Response(JSON.stringify(j), {
              status: res.status,
              statusText: res.statusText,
              headers: res.headers
            });
          } catch (_) { return res; }
        }
        report(1);
        return new Response(cleaned, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers
        });
      } catch (_) {
        return res;
      }
    });
  };

  const XO = XMLHttpRequest.prototype.open;
  const XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__ytUrl = url == null ? '' : String(url);
    return XO.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('readystatechange', function () {
      if (!enabled || this.readyState !== 4) return;
      const u = this.__ytUrl || '';
      if (!playerRe.test(u) && !u.includes('player') && !u.includes('get_watch')) return;
      try {
        const raw = this.responseText;
        if (!raw || (!raw.includes('adPlacements') && !raw.includes('adSlots') && !raw.includes('playerAds'))) return;
        let out = textStrip(raw).text;
        try {
          const j = _parse(out);
          stripAndReport(j);
          out = JSON.stringify(j);
        } catch (_) {}
        report(1);
        Object.defineProperty(this, 'responseText', { configurable: true, get: () => out });
        Object.defineProperty(this, 'response', {
          configurable: true,
          get: () => {
            try { return _parse(out); } catch (_) { return out; }
          }
        });
      } catch (_) {}
    });
    return XS.apply(this, args);
  };

  const patchPlayer = () => {
    const p = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
    if (!p || p.__ytAblP) return;
    p.__ytAblP = 1;
    if (typeof p.getPlayerResponse === 'function') {
      const gpr = p.getPlayerResponse.bind(p);
      p.getPlayerResponse = function () {
        const r = gpr();
        if (enabled) {
          try { stripAndReport(r); } catch (_) {}
        }
        return r;
      };
    }
  };

  let lastSkipReport = 0;
  const skip = () => {
    if (!enabled) return;
    try {
      let did = false;
      const player = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
      if (player && player.classList.contains('ad-showing')) {
        const v = player.querySelector('video');
        if (v && v.duration && isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration) {
          v.currentTime = v.duration;
          did = true;
        }
        const btn =
          document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-container button, .ytp-ad-skip-button-slot button');
        if (btn) { btn.click(); did = true; }
      }
      const mbtn = document.querySelector('.ytmAdSkipButtonHost, .ytm-ad-skip, button[class*="skip"]');
      if (mbtn && document.querySelector('.ad-showing, .ytp-ad-player-overlay')) {
        mbtn.click();
        did = true;
      }
      patchPlayer();
      if (did) {
        const now = Date.now();
        if (now - lastSkipReport > 1500) {
          lastSkipReport = now;
          report(1);
        }
      }
    } catch (_) {}
  };

  const mo = new MutationObserver(() => skip());
  const start = () => {
    if (document.documentElement) {
      mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    skip();
  };
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
  setInterval(skip, 500);

  try {
    const a = {
      apply(t, th, args) {
        if (!enabled) return Reflect.apply(t, th, args);
        const fn = args[0];
        if (typeof fn === 'function' && /onAbnormalityDetected/.test(Function.prototype.toString.call(fn))) {
          args[0] = function () {};
        }
        return Reflect.apply(t, th, args);
      }
    };
    Promise.prototype.then = new Proxy(Promise.prototype.then, a);
  } catch (_) {}
})();
