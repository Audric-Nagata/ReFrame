// ReFrame extension — popup: activation, status, log copy.

interface PopupState {
  enabled: boolean;
  log: string[];
  ack?: string;
}

const statusEl = document.getElementById('status') as HTMLSpanElement;
const toggleBtn = document.getElementById('toggle') as HTMLButtonElement;
const copyBtn = document.getElementById('copy-log') as HTMLButtonElement;
const logPreview = document.getElementById('log-preview') as HTMLPreElement;

async function reframeActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function reframeRefresh() {
  const state = (await chrome.runtime.sendMessage({ kind: 'popup-state' })) as PopupState | undefined;
  const ack = state?.ack ?? '';
  statusEl.textContent = state?.enabled
    ? (ack || 'Active on this tab')
    : ack.startsWith('error')
      ? ack
      : 'Inactive';
  statusEl.className = state?.enabled ? 'state state-on' : 'state';
  toggleBtn.textContent = state?.enabled ? 'Disable ReFrame' : 'Enable ReFrame';
  const log = state?.log ?? [];
  logPreview.textContent = log.length ? log.join('\n') : 'No log entries yet.';
}

toggleBtn.addEventListener('click', () => {
  void (async () => {
    const tab = await reframeActiveTab();
    if (tab?.id == null) {
      statusEl.textContent = 'No active tab';
      return;
    }
    if (!tab.url || !tab.url.includes('youtube.com/watch')) {
      statusEl.textContent = 'Open a youtube.com/watch video first';
      return;
    }
    await chrome.runtime.sendMessage({ kind: 'toggle', tabId: tab.id });
    await reframeRefresh();
  })();
});

copyBtn.addEventListener('click', () => {
  void navigator.clipboard.writeText(logPreview.textContent ?? '').then(() => {
    copyBtn.textContent = 'Copied';
    setTimeout(() => (copyBtn.textContent = 'Copy log'), 1500);
  });
});

void reframeRefresh();
setInterval(() => void reframeRefresh(), 2000);
