# kumpan-intra-recorder

Companion app for [intra.kumpan.se](https://intra.kumpan.se) — records meeting audio and uploads it for AI transcription, project description drafting, and estimate seeding.

## Install

### macOS

1. Download the `.dmg` from the [latest GitHub release](../../releases/latest).
2. Open the `.dmg` and drag the app to **Applications**.
3. **First launch:** right-click the app in Applications → **Open**.
4. At the Gatekeeper warning, click **Open** again.

> The app is unsigned. macOS will only show the warning on first launch — subsequent opens work normally.

### Windows

1. Download the `.exe` from the [latest GitHub release](../../releases/latest).
2. Double-click to run.
3. At the SmartScreen prompt, click **More info** → **Run anyway**.

> The app is unsigned. Windows will only show this prompt on first run.

## Getting your API token

Generate a token in your intra settings page, then paste it into the app's Settings window (tray icon → **Settings…** → **Intra API Token**).

## System requirements

| Platform | Minimum version |
| -------- | --------------- |
| macOS    | 13 (Ventura)    |
| Windows  | 10 1903+        |

## Usage

1. Start a meeting in Google Meet, Zoom, Teams, or any other tool.
2. Click the menubar / tray icon → **Start Recording**.
3. When the meeting ends, click the tray icon → **Stop Recording**.
4. Choose **Upload**, **Save locally**, or **Discard** in the modal that appears.

Recordings are never uploaded automatically — you always confirm first.
