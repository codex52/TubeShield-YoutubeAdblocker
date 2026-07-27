/* TubeShield — service worker */
const DEFAULTS = { enabled: true, blocked: 0 };

async function getState() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return {
    enabled: s.enabled !== false,
    blocked: Number(s.blocked) || 0
  };
}

async function setEnabled(enabled) {
  await chrome.storage.local.set({ enabled: !!enabled });
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    enabled
      ? { enableRulesetIds: ['yt_ads'] }
      : { disableRulesetIds: ['yt_ads'] }
  );
  await updateBadge();
}

async function bump(n = 1) {
  const { enabled, blocked } = await getState();
  if (!enabled || n < 1) return blocked;
  const next = blocked + n;
  await chrome.storage.local.set({ blocked: next });
  await updateBadge();
  return next;
}

async function updateBadge() {
  const { enabled, blocked } = await getState();
  await chrome.action.setBadgeText({ text: '' });
  await chrome.action.setTitle({
    title: enabled
      ? `TubeShield — ${blocked} ads blocked`
      : 'TubeShield — OFF'
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(null);
  if (cur.enabled === undefined) await chrome.storage.local.set(DEFAULTS);
  if (cur.blocked === undefined) await chrome.storage.local.set({ blocked: 0 });
  const { enabled } = await getState();
  await setEnabled(enabled);
});

chrome.runtime.onStartup.addListener(updateBadge);

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'getState') {
      sendResponse(await getState());
      return;
    }
    if (msg?.type === 'setEnabled') {
      await setEnabled(!!msg.enabled);
      sendResponse(await getState());
      return;
    }
    if (msg?.type === 'bump') {
      const blocked = await bump(Number(msg.n) || 1);
      sendResponse({ blocked });
      return;
    }
    if (msg?.type === 'resetCount') {
      await chrome.storage.local.set({ blocked: 0 });
      await updateBadge();
      sendResponse(await getState());
      return;
    }
  })();
  return true;
});

// Network blocks (unpacked + declarativeNetRequestFeedback)
if (chrome.declarativeNetRequest?.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(async (info) => {
    if (info?.rule?.rulesetId === 'yt_ads') await bump(1);
  });
}

updateBadge();
