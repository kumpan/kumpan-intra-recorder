# kumpan-intra-recorder

Companion macOS + Windows menubar/tray app for **intra.kumpan.se**. Records the user's meeting audio (system + mic) locally, then offers to upload it to intra for AI transcription and project/estimate generation.

## Why this exists

Kumpan salespeople run new-customer meetings in Google Meet (occasionally Zoom/Teams/in-person). They want a one-click way to capture the audio and let intra's AI summarise the conversation, draft a project description, and seed an estimate —
instead of writing it by hand. The companion app exists because (a) a Meet bot is fragile and an arms race with Google's anti-bot, and (b) browser tab-capture has friction (manual share-screen dance, easy to forget the "share tab audio"
checkbox).

This app is the **recorder only**. All transcription, summarisation, and project/estimate generation happens server-side in intra after upload.

## Audience

Internal tool for ~30 Kumpan employees. Distributed via GitHub Releases. No App Store, no Authenticode signing.

- **macOS**: signed with Kumpan's Developer ID and notarised by `scripts/release.sh`, so it opens without Gatekeeper warnings and keeps its Screen Recording grant across updates. Releases up to v0.1.5 were unsigned; `src/main/update-notice.ts` walks those users through re-granting once.
- **Windows**: unsigned NSIS installer. SmartScreen → "More info" → Run anyway, on first install only.
- **Updates**: `src/main/updater.ts` (electron-updater) checks the public GitHub releases at launch and every 6h, downloads in the background and offers a restart — never mid-recording. Tray → "Check for Updates…" does it on demand. It reads `latest-mac.yml` / `latest.yml` from the release, so those files must be uploaded with every build.

## Tech stack

- **Electron** (latest stable) via **electron-vite**
- **TypeScript** strict, no `any`
- **React** for renderer UI (settings + post-recording modal)
- **electron-builder** for packaging (`.dmg` + `.zip` and an NSIS `.exe` installer)
- **electron-updater** for updates from GitHub Releases
- **Electron `safeStorage`** for encrypting the intra API token at rest (no `keytar` — it's unmaintained and adds a native dep)
- **pnpm** package manager (matches intra repo)

## Architecture

Two-process Electron app, standard main/renderer split.

**Main process** (`src/main/`)

- App lifecycle, tray icon, menus
- IPC orchestration
- File system: write tmp recording chunks, delete on discard
- HTTP upload to intra — the bearer token never leaves main, renderer only sees "uploading / done / failed"
- `safeStorage` for token encryption
- Meeting detection: polls `desktopCapturer.getSources({ types: ["window"] })` every 12s and
  matches window titles (`src/main/meeting-match.ts`). A hit floats a banner offering
  one-click record. Reuses the Screen Recording grant, so it stays silent until that grant
  exists — polling earlier would spring the OS prompt before the user ever presses Record.
  - A match is reduced to a **stable key** (the Meet code, or the normalised title) so one
    call keeps one identity while its window title churns — tab switches, unread badges,
    browser-name suffixes. `src/main/meeting-tracker.ts` holds each call across a 90s
    grace window and hands out **one banner per call**, which is what keeps the nudge
    from reappearing every time focus moves. It is pure, so `pnpm check` covers it.
  - Stop reminders (`src/main/stop-reminder.ts`) keep the same poll running while
    recording. When every call seen during the recording has been gone past the grace
    window, or the mix has been silent for 5 minutes, the banner comes back asking to
    stop. Ignored or dismissed, it snoozes 10 minutes and returns — the user who forgets
    to stop is usually not at the screen.
  - Both prompts share one banner window, brokered by `src/main/banner.ts`: whoever shows
    it supplies the context and the accept/dismiss handlers.
- Settings persisted as encrypted JSON in `app.getPath("userData")`

**Renderer process** (`src/renderer/`)

- Audio capture (Web APIs only exist here):
  - `desktopCapturer.getSources()` (proxied through main via IPC) → source IDs
  - System audio: `getUserMedia({ audio: { mandatory: { chromeMediaSource: "desktop", chromeMediaSourceId } } })`
  - Mic: `getUserMedia({ audio: true })`
  - **Web Audio API** mixes them into **stereo: system audio on left, mic on right**. This single trick lets the server-side transcriber distinguish "you" from "everyone else on the call" without any extra diarisation work.
  - `MediaRecorder` encodes to `audio/webm; codecs=opus`, ~0.5 MB/min. Chunks streamed to main via IPC, appended to tmp file.
  - An `AnalyserNode` taps the same mix to measure RMS once a second. Only the renderer can see the audio, so it reports "quiet" / "not quiet" to main; main decides how much quiet is worth interrupting for.
- Settings window
- Post-recording modal (Upload / Save locally / Discard)

**Preload** (`src/preload/`)

- Exposes a typed `window.api` to the renderer via `contextBridge`. No node access in renderer.

**IPC contract** lives in `src/shared/ipc.ts` — all channel names as string consts, never hardcoded at call sites.

## Audio capture specifics

**macOS**

- System audio capture via `desktopCapturer` triggers the **Screen Recording** permission prompt. Show a friendly explainer modal _before_ triggering it for the first time so the OS prompt isn't a surprise.
- **Microphone** permission also required.
- macOS 13+ only.

**Windows**

- System audio via `desktopCapturer` uses WASAPI loopback under the hood — no system permission needed.
- **Microphone** permission required (Windows 10+ privacy settings).
- Windows 10 1903+.

## File handling

- During recording: append chunks to `app.getPath("temp")/kumpan-recording-<iso>.webm`.
- On stop: file kept, modal shown.
- On **Upload**: stream to intra, delete on 2xx.
- On **Save locally**: native save dialog.
- On **Discard**: delete immediately.

Recordings **never auto-upload**. The modal always shows first — user-controlled privacy is the whole point of the client-side approach.

## Upload contract (with intra)

```
POST {baseUrl}/api/transcripts/upload
Authorization: Bearer <user-token>
Content-Type: multipart/form-data

Fields:
  file:      <webm audio blob>
  duration:  <seconds, integer>
  startedAt: <ISO timestamp>
  endedAt:   <ISO timestamp>

200 → { id: string, viewUrl: string }
401 → invalid token
413 → over size cap (intra cap: 200 MB)
```

Tokens are generated per-user in intra's settings page. User pastes once into the recorder's settings.

## Commands

```bash
pnpm dev            # electron-vite dev, hot-reload main + renderer
pnpm typecheck      # tsc --noEmit (both processes)
pnpm check          # assert-based self-checks: meeting-title matcher + meeting tracker
pnpm format         # prettier
pnpm build          # type-check + bundle (no packaging)
pnpm dist:mac       # .dmg
pnpm dist:win       # NSIS installer — Windows only; fails on Apple
                    # Silicon because electron-builder's makensis is Intel-only.
                    # CI (.github/workflows/windows-release.yml) builds it on release.
```

## Conventions

- Prettier: no semis, double quotes, 2-space indent, ES5 trailing commas.
- Path alias: `@/*` → `src/*` (configure in `tsconfig.json`, `electron.vite.config.ts`, and any test runner).
- TypeScript strict, no `any`.
- No comments unless the WHY is non-obvious. Don't narrate WHAT.
- IPC channel names: string consts in `src/shared/ipc.ts`.
- Errors surfaced via toast in renderer, never silent `console.error` in main.

## Out of scope for v1

Lock these out:

- Real-time transcription. Upload happens post-stop.
- Lead/deal picker in the recorder — intra handles assignment after upload.
- Auto-**starting** a recording. The meeting banner detects a live Meet/Zoom window and
  offers a one-click start, but nothing records without a click. Stopping is prompted the
  same way — the banner asks when the call ends or the room goes quiet — but never
  automatic.
- Windows code signing.
- Linux build.

## Build phases

1. **Foundation** — scaffold electron-vite, tray, settings window with token storage. No recording.
2. **Recording** — desktopCapturer + Web Audio mixer + MediaRecorder → tmp file.
3. **Upload** — post-stop modal, multipart upload to intra, progress UI.
4. **Ship** — error handling, packaging, install instructions for Slack distribution.
