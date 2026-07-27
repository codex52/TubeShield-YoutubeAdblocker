const toggle = document.getElementById('toggle');
const countEl = document.getElementById('count');
const countBoxEl = document.getElementById('count-box');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('reset');

function render({ enabled, blocked }) {
  toggle.checked = !!enabled;
  const newCount = String(blocked || 0);
  if (countEl.textContent !== newCount) {
    countEl.textContent = newCount;
    if (countBoxEl) {
      countBoxEl.classList.remove('pop');
      void countBoxEl.offsetWidth;
      countBoxEl.classList.add('pop');
    }
  }
  const statusTextEl = document.getElementById('status-text');
  if (statusTextEl) statusTextEl.textContent = enabled ? 'ON' : 'OFF';
  else statusEl.textContent = enabled ? 'ON' : 'OFF';
  statusEl.className = 'status ' + (enabled ? 'on' : 'off');
}

async function refresh() {
  const s = await chrome.runtime.sendMessage({ type: 'getState' });
  if (s) render(s);
}

toggle.addEventListener('change', async () => {
  const s = await chrome.runtime.sendMessage({
    type: 'setEnabled',
    enabled: toggle.checked
  });
  if (s) render(s);
});

resetBtn.addEventListener('click', async () => {
  const s = await chrome.runtime.sendMessage({ type: 'resetCount' });
  if (s) render(s);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  chrome.storage.local.get({ enabled: true, blocked: 0 }, (s) => render(s));
});

refresh();
