# ReFrame — Local Prototype

Move a gaming video's facecam wherever you want: drag it, resize it, hide it, or cover the original spot. Phase 0 feasibility prototype — runs fully local, no accounts, no server, no YouTube/Twitch support (yet).

> **Honest limitation:** this is a *crop* of one composited video, not a separate facecam source. Covering the original spot hides the facecam — it cannot restore the gameplay behind it. The **Detect facecam** button is an experimental feasibility test: a detected face is not proof of the streamer or the full webcam boundary.

## Quick start

**1. Open a terminal** (PowerShell on Windows, any terminal on macOS/Linux) in this folder:

```powershell
cd C:\Users\<your folder>\ReFrame
```

**2. Install dependencies** (first time only, takes ~30 s):

```powershell
npm install
```

You'll see something like `added 60 packages, and audited 61 packages in 8s`. Any warnings about funding/vulnerabilities reporting `0 vulnerabilities` are normal.

**3. Add your test video** (required, one time):

Put any short MP4 you have rights to at:

```
public\sample-video\test.mp4
```

No video? The page loads anyway and shows a yellow notice telling you where to put the file.

**4. Start the dev server:**

```powershell
npm run dev
```

Expect:

```
  VITE ready in ~300 ms
  ➜  Local:   http://localhost:5173/
```

**5. Open <http://localhost:5173>** in Chrome/Edge. You'll see the video with a blue-outlined box (the facecam overlay) on top of it.

**6. Stop the server** with `Ctrl + C` in the terminal when done.

## What to try

| Action | How |
|---|---|
| Move the facecam | Drag the blue-outlined box |
| Resize it | Drag the small blue corner (bottom-right) |
| Free stretch | Tick **Customize aspect ratio** |
| Hide / show | **Hide facecam** button |
| Shrink / grow | **Smaller** / **Larger** buttons |
| Cover the original facecam | Tick **Cover original facecam** (shows the warning) |
| See what's being cropped | The yellow **dashed outline** on the video (toggle in Controls) |
| Move the original crop region | Edit the X / Y / W / H numbers (%) |
| Auto-suggest the crop | **Detect facecam** (experimental — first click downloads a ~5 MB model from a CDN, cached after), then **Use this region** and correct manually |
| Log a bad detection | **Flag as incorrect**, then **Copy log** to share results |
| Back to defaults | **Reset layout** |

Everything is keyboard reachable with `Tab` + `Enter`/`Space`. All buttons have visible focus rings.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run lint` | Lint the source (oxlint) |
| `npm run preview` | Serve the production build locally |

## Troubleshooting

- **Yellow "No video found" notice** — `test.mp4` is missing or misspelled at `public\sample-video\test.mp4`. Reload after fixing.
- **Port 5173 already in use** — another dev server is running; close it or run `npm run dev -- --port 5174`.
- **`npm: command not found`** — install Node.js (LTS) from <https://nodejs.org>, then reopen the terminal.
- **Video plays but the crop looks wrong** — adjust the X/Y/W/H crop numbers to match where the facecam actually sits in *your* video.

## ReFrame extension (feasibility spike)

Load-unpacked, YouTube `watch` pages only:

```powershell
npm install
npm run build:ext        # compiles TS + copies manifest/HTML + vendors MediaPipe (~40 MB, local, no CDN)
```

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → select the `extension/` folder.
3. Open any `youtube.com/watch` video, click the ReFrame icon, **Enable ReFrame**.
4. Status/log live in the popup (**Copy log** shares results). On the video: a toolbar appears top-left; detection samples ~1×/s and auto-places the crop on the first confident face — drag it, resize it, mask the original, or try **Segment person** (experimental cutout, updates ~1×/s).

Known spike limits: `/watch` only (no Shorts/embeds), detection needs a visible face, the crop is still a composited-video crop (masked pixels are gone, not restored), and MediaPipe WASM runs from the bundled local files.

## Docs

Product and scope live in [`prd.md`](prd.md), technical direction in [`architecture.md`](architecture.md), rules in [`rules.md`](rules.md), design tokens in [`design.md`](design.md), progress log in [`memory.md`](memory.md).
