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
2. Click the menubar / tray icon → **Start Recording**. For Meet and Zoom a banner offers
   this with one click — once per call, not every time you switch window.
3. When the meeting ends, click the tray icon → **Stop Recording**. If you forget, the
   banner reappears once the call is gone or nobody has spoken for five minutes.
4. Choose **Upload**, **Save locally**, or **Discard** in the modal that appears.

Recordings are never uploaded automatically — you always confirm first. Both banners can
be turned off in Settings.

## Releasing (maintainers)

A new release ships a `.dmg` (Apple Silicon + Intel) and a portable `.exe` to [GitHub Releases](../../releases). Two ways to cut one:

- **In Claude Code:** type `/release` and let the bundled skill at `.claude/skills/release/SKILL.md` discover the latest tag, bump the version, draft a changelog from commits, and run the build after you confirm. Use `/release patch`, `/release minor`, `/release major`, or `/release vX.Y.Z` to control the bump.
- **From the shell:** run `pnpm release vX.Y.Z "release notes"`. The script (`scripts/release.sh`) tags, runs `electron-builder` for macOS + Windows, and uploads to a new GitHub Release via `gh`.

Prereqs: `gh auth login`, a clean working tree, and you're on `main`.
