// ReFrame extension — background service worker (classic script).
// ponytail: enabled flag lives in SW memory only; MV3 SW can sleep and lose it.
// Acceptable for the spike — popup re-syncs, content script keeps running.
(() => {

interface ReframeBgMessage {
  kind?: string;
  tabId?: number;
  log?: string[];
}

let reframeEnabled = false;
let reframeLastLog: string[] = [];
let reframeLastAck = 'not activated yet';

async function reframeEnsureOffscreen(): Promise<void> {
  if (!chrome.offscreen?.hasDocument) {
    throw new Error('chrome.offscreen unavailable — Chrome 116+ required');
  }
  const has = await chrome.offscreen.hasDocument();
  if (!has) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Run local MediaPipe face detection/segmentation away from page Trusted Types',
    });
  }
}

chrome.runtime.onMessage.addListener((msg: ReframeBgMessage, _sender, sendResponse) => {
  if (msg.kind === 'frame') {
    // content → offscreen (Promise relay; only offscreen answers 'task').
    // spread first: msg.kind ('frame') must not clobber the 'task' tag.
    void chrome.runtime
      .sendMessage({ ...msg, kind: 'task' })
      .then((r) => {
        if (r === undefined) {
          console.error('[ReFrame] task relay: offscreen did not answer');
          sendResponse({ ok: false, error: 'offscreen did not answer' });
        } else {
          sendResponse(r);
        }
      })
      .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg.kind === 'content-log') {
    reframeLastLog = msg.log ?? [];
    return;
  }
  if (msg.kind === 'toggle' && typeof msg.tabId === 'number') {
    const tabId = msg.tabId;
    void (async () => {
      try {
        if (!reframeEnabled) {
          await reframeEnsureOffscreen();
          let ack: { attached?: boolean; video?: string | null; detail?: string } | undefined;
          try {
            ack = (await chrome.tabs.sendMessage(tabId, { kind: 'activate' })) as typeof ack;
          } catch {
            // static injection missed (extension reloaded after the tab opened) — inject now, retry once
            console.warn('[ReFrame] no content script — injecting via chrome.scripting');
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['repair.js', 'repair-history.js', 'repair-fill.js', 'repair-ui.js', 'content.js', 'overlay.js'],
            });
            ack = (await chrome.tabs.sendMessage(tabId, { kind: 'activate' })) as typeof ack;
          }
          reframeEnabled = true;
          reframeLastAck = ack?.attached
            ? `attached to video ${ack.video ?? '(loading)'}`
            : `enabled — ${ack?.detail ?? 'waiting for video'}`;
          sendResponse({ enabled: true, ack: reframeLastAck });
        } else {
          await chrome.tabs.sendMessage(tabId, { kind: 'deactivate' }).catch(() => {});
          reframeEnabled = false;
          reframeLastAck = 'disabled';
          sendResponse({ enabled: false, ack: reframeLastAck });
        }
      } catch (err) {
        reframeEnabled = false;
        reframeLastAck = `error: ${err instanceof Error ? err.message : String(err)}`;
        console.error('[ReFrame] toggle failed:', err);
        sendResponse({ enabled: false, error: reframeLastAck });
      }
    })();
    return true;
  }
  if (msg.kind === 'popup-state') {
    void (async () => sendResponse({ enabled: reframeEnabled, log: reframeLastLog, ack: reframeLastAck }))();
    return true;
  }
  if (msg.kind === 'log' && typeof msg.tabId === 'number') {
    void chrome.tabs
      .sendMessage(msg.tabId, { kind: 'get-log' })
      .then(() => sendResponse({ log: reframeLastLog }))
      .catch(() => sendResponse({ log: reframeLastLog }));
    return true;
  }
});
})();
