/* ISOLATED WORLD — on/off bridge, auto-skip, count, in-page UI */
(() => {
  let enabled = true;
  let lastSkip = 0;
  let lastStrip = 0;

  let widgetApi = null;

  const initWidget = () => {
    if (widgetApi || !document.body) return;
    const host = document.createElement('div');
    host.id = 'yt-abl-widget-host';
    host.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:2147483647; font-family:Roboto, Arial, sans-serif; pointer-events:none;';

    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        * { box-sizing: border-box; }
        .badge {
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(15, 15, 15, 0.9);
          color: #f1f1f1;
          padding: 6px 12px;
          border-radius: 20px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          font-size: 12px;
          font-weight: 500;
          user-select: none;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .badge:hover {
          background: rgba(24, 24, 24, 0.96);
          box-shadow: 0 6px 18px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.18);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ff4e4e;
          box-shadow: 0 0 6px rgba(255, 78, 78, 0.8);
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .dot.off {
          background: #757575;
          box-shadow: none;
        }
        .label-text {
          font-weight: 600;
          color: #ffffff;
          font-size: 11px;
          letter-spacing: 0.2px;
        }
        .count-pill {
          background: rgba(255, 255, 255, 0.12);
          padding: 2px 7px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          color: #ff4e4e;
          min-width: 20px;
          text-align: center;
          transition: color 0.2s ease;
        }
        .count-pill.off {
          color: #888888;
        }
        .switch {
          position: relative;
          width: 32px;
          height: 18px;
          flex-shrink: 0;
          cursor: pointer;
        }
        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          inset: 0;
          background-color: #555555;
          border-radius: 18px;
          transition: 0.2s;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 2px;
          bottom: 2px;
          background-color: #ffffff;
          border-radius: 50%;
          transition: 0.2s;
        }
        input:checked + .slider {
          background-color: #cc0000;
        }
        input:checked + .slider:before {
          transform: translateX(14px);
        }
        .min-btn {
          background: none;
          border: none;
          color: #888;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          padding: 0 0 0 2px;
          margin-left: 2px;
        }
        .min-btn:hover {
          color: #fff;
        }
        .badge.minimized .label-text,
        .badge.minimized .switch {
          display: none;
        }
        .badge.minimized {
          padding: 6px 10px;
        }
      </style>
      <div class="badge" id="badge">
        <div class="dot" id="dot"></div>
        <span class="label-text">TubeShield</span>
        <span class="count-pill" id="count-pill">0</span>
        <label class="switch">
          <input type="checkbox" id="widget-toggle" checked>
          <span class="slider"></span>
        </label>
        <button class="min-btn" id="min-btn" title="Toggle compact view">–</button>
      </div>
      <div style="font-size: 6.5px; color: #ff4e4e; text-align: right; margin-top: 2px; padding-right: 4px; font-weight: 600; opacity: 0.8; text-shadow: 0 1px 2px rgba(0,0,0,0.8);">Developed by uBlock Origin x Tarek</div>
    `;

    document.body.appendChild(host);

    const toggle = shadow.getElementById('widget-toggle');
    const dot = shadow.getElementById('dot');
    const countPill = shadow.getElementById('count-pill');
    const badge = shadow.getElementById('badge');
    const minBtn = shadow.getElementById('min-btn');

    let isMin = false;
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isMin = !isMin;
      badge.classList.toggle('minimized', isMin);
      minBtn.textContent = isMin ? '+' : '–';
    });

    toggle.addEventListener('change', () => {
      const isChecked = toggle.checked;
      try {
        chrome.runtime.sendMessage({ type: 'setEnabled', enabled: isChecked });
      } catch (_) {
        chrome.storage.local.set({ enabled: isChecked });
      }
    });

    widgetApi = {
      update: (isOn, blockedCount) => {
        toggle.checked = !!isOn;
        dot.className = 'dot' + (isOn ? '' : ' off');
        countPill.className = 'count-pill' + (isOn ? '' : ' off');
        const num = Number(blockedCount) || 0;
        countPill.textContent = num > 9999 ? '9k+' : String(num);
      }
    };

    updateWidgetState();
  };

  const updateWidgetState = () => {
    try {
      chrome.storage.local.get({ enabled: true, blocked: 0 }, (s) => {
        if (widgetApi) {
          widgetApi.update(s.enabled !== false, s.blocked || 0);
        }
      });
    } catch (_) {}
  };

  const setPageEnabled = (on) => {
    try {
      window.dispatchEvent(new CustomEvent('yt-abl-set', { detail: { enabled: !!on } }));
      document.documentElement.dataset.ytAbl = on ? '1' : '0';
    } catch (_) {}
  };

  const bump = (n = 1) => {
    if (!enabled || n < 1) return;
    try { chrome.runtime.sendMessage({ type: 'bump', n }); } catch (_) {}
  };

  // Counts from MAIN world inject.js
  window.addEventListener('yt-abl-block', (e) => {
    const n = Number(e?.detail?.n) || 1;
    bump(n);
  });

  const scanAdElements = () => {
    if (!enabled) return;
    const adSelectors = [
      'ytd-ad-slot-renderer',
      'ytd-banner-promo-renderer',
      'ytd-statement-banner-renderer',
      'ytd-in-feed-ad-layout-renderer',
      'ytd-promoted-sparkles-web-renderer',
      'ytd-promoted-video-renderer',
      'ytd-display-ad-renderer',
      'ytd-action-companion-ad-renderer',
      '#masthead-ad',
      '#player-ads',
      '.ytp-ad-overlay-container',
      '.ytp-ad-module',
      'ytd-search-pyv-renderer',
      'ytm-companion-slot',
      'ytm-promoted-sparkles-web-renderer'
    ];
    try {
      const nodes = document.querySelectorAll(adSelectors.join(','));
      let newCount = 0;
      nodes.forEach((node) => {
        if (!node.dataset.ytAblCounted) {
          node.dataset.ytAblCounted = '1';
          newCount++;
        }
      });
      if (newCount > 0) bump(newCount);
    } catch (_) {}
  };

  const trySkip = () => {
    if (!enabled) return;
    const root = document;
    let did = false;
    const selectors = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      '.ytp-ad-skip-button-container button',
      '.ytp-ad-skip-button-slot button',
      'button.ytp-ad-skip-button-modern',
      '.ytmAdSkipButtonHost button',
      '.videoAdUiSkipButton',
      '.ytp-ad-overlay-close-button'
    ];
    for (const s of selectors) {
      const el = root.querySelector(s);
      if (el) { el.click(); did = true; break; }
    }
    const player = root.querySelector('#movie_player.ad-showing, .html5-video-player.ad-showing');
    if (player) {
      const v = player.querySelector('video');
      if (v && Number.isFinite(v.duration) && v.duration > 0) {
        try {
          if (v.currentTime < v.duration - 0.25) {
            v.currentTime = Math.max(v.currentTime, v.duration - 0.1);
            did = true;
          }
        } catch (_) {}
      }
    }
    root.querySelectorAll('ytd-enforcement-message-view-model, tp-yt-paper-dialog.ytd-popup-container').forEach((n) => {
      const t = (n.textContent || '').toLowerCase();
      if (t.includes('ad blocker') || t.includes('adblock') || t.includes('blockers') || t.includes('premium')) {
        n.remove();
        did = true;
      }
    });
    if (did) {
      const now = Date.now();
      if (now - lastSkip > 300) {
        lastSkip = now;
        bump(1);
      }
    }
  };

  const applyCss = (on) => {
    const id = 'yt-abl-hide';
    let el = document.getElementById(id);
    if (on) {
      if (!el) {
        el = document.createElement('link');
        el.id = id;
        el.rel = 'stylesheet';
        el.href = chrome.runtime.getURL('hide.css');
        (document.head || document.documentElement).appendChild(el);
      }
    } else if (el) {
      el.remove();
    }
  };

  // hide.css is also injected via manifest; toggle by disabling sheet
  const setStyleSheets = (on) => {
    for (const sheet of document.styleSheets) {
      try {
        if (sheet.href && sheet.href.includes('hide.css')) {
          sheet.disabled = !on;
        }
      } catch (_) {}
    }
  };

  const apply = (on) => {
    enabled = !!on;
    setPageEnabled(enabled);
    setStyleSheets(enabled);
    updateWidgetState();
  };

  chrome.storage.local.get({ enabled: true, blocked: 0 }, (s) => {
    apply(s.enabled !== false);
    updateWidgetState();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) apply(changes.enabled.newValue !== false);
    if (changes.blocked || changes.enabled) updateWidgetState();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'enabledChanged') apply(!!msg.enabled);
  });

  const tick = () => {
    trySkip();
    scanAdElements();
    if (!widgetApi && document.body) initWidget();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick, { once: true });
  } else {
    tick();
  }
  setInterval(tick, 300);
  new MutationObserver(tick).observe(document.documentElement || document, {
    childList: true,
    subtree: true
  });
})();
