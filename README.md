# ReFrame (MV3 extension)

Move a YouTube facecam wherever you want: drag it, resize it, hide it, cover the original spot — and (experimental) fill the original spot with an **estimate** of the gameplay behind it, built from nearby frames. Runs fully local: no accounts, no telemetry, no remote code (MediaPipe is bundled in `extension/lib/`).

> **Honest limitations:** the moved facecam is a *crop* of one composited video, not a separate source. Fills over the original spot are **estimates reconstructed from neighboring frames — not the real recorded pixels**; when confidence is low the extension falls back to a plain cover and says so in the status line. Detection/repair only run on `youtube.com/watch` pages that have actually been tested — nothing beyond that is claimed.

## Build

```powershell
npm install       # first time
npm run build:ext # tsc → extension/ + static files + vendor MediaPipe models
npm run lint
```

## Load it

1. Chrome → `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the `extension/` folder
3. Open a `youtube.com/watch` video, click the ReFrame icon → **Enable ReFrame**

## Use it

- On-video bar: **Hide facecam**, **Reset**, **Detect now**, **Mark facecam** (drag a box over the cam), **Cover original**, **Segment person**, **Repair (experimental)** + mode select
- Status line on the video shows detection + repair state (`repair: 61% cover · 7 ms` or `repair: masked (score 0.31)`)
- Popup: enable/disable, live log, **Copy log**

## Testing the repair (Stage 1)

Follow `docs/repair-tests.md`: 5 modes × 4 segment types, metrics read from the on-video status line and the popup log. Modes: Repair off (original) / Cover original (mask) / Basic edge fill / Reuse, no align (control) / Reuse, motion-aligned.

## Repo layout

- `src/extension/` — TypeScript sources (classic-script MV3; `repair*.ts` = background-fill experiments)
- `extension/` — build output, load this in Chrome (gitignored, rebuilt by `npm run build:ext`)
- `docs/` — PRD, architecture, rules, decisions (`memory.md`), test plans
- `archive/harness/` — the retired localhost prototype (see `docs/memory.md` D-015)
