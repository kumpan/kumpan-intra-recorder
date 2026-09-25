# kumpan-intra-recorder

Companion app for [intra.kumpan.se](https://intra.kumpan.se) — records meeting audio and uploads it for AI transcription, project description drafting, and estimate seeding.

## Install

### macOS

1. Download the `.dmg` from the [latest GitHub release](../../releases/latest) — `-arm64` for Apple Silicon, `-x64` for Intel.
2. Open the `.dmg` and drag the app to **Applications**.

### Windows

1. Download the `-setup.exe` from the [latest GitHub release](../../releases/latest).
2. Double-click to install.
3. At the SmartScreen prompt, click **More info** → **Run anyway**. Only on first install.

### Updates

The app checks for updates on launch and every few hours, downloads them in the background, and shows **Restart** in the tray panel when one is ready. **Check for updates** at the bottom of the panel checks right away.

## Getting your API token

Generate a token in your intra settings page, then paste it into the app's Settings window (tray icon → ⚙ → **Intra API Token**).

## System requirements

| Platform | Minimum version |
| -------- | --------------- |
| macOS    | 13 (Ventura)    |
| Windows  | 10 1903+        |

## Usage

1. Start a meeting in Google Meet, Zoom, Teams, or any other tool.
2. Click the menubar / tray icon → **Start recording**. For Meet and Zoom a banner offers
   this with one click — once per call, not every time you switch window.
3. When the meeting ends, click the tray icon → **Stop recording**. If you forget, the
   banner reappears once the call is gone or nobody has spoken for five minutes.
4. Choose **Upload**, **Save locally**, or **Discard** in the panel that opens. Click away and
   it waits — the ● next to the menubar icon means a recording still needs a decision.

Recordings are never uploaded automatically — you always confirm first. Both banners can
be turned off in Settings.

## Releasing (maintainers)

A new release ships a signed, notarised `.dmg` + update `.zip` (Apple Silicon + Intel) and a Windows installer to [GitHub Releases](../../releases). Two ways to cut one:

- **In Claude Code:** type `/release` and let the bundled skill at `.claude/skills/release/SKILL.md` discover the latest tag, bump the version, draft a changelog from commits, and run the build after you confirm. Use `/release patch`, `/release minor`, `/release major`, or `/release vX.Y.Z` to control the bump.
- **From the shell:** run `pnpm release vX.Y.Z "release notes"`. The script (`scripts/release.sh`) tags, runs `electron-builder` for macOS + Windows, and uploads to a new GitHub Release via `gh`.

Prereqs: `gh auth login`, a clean working tree, you're on `main`, and your keychain holds Kumpan's Developer ID certificate plus the `PassboltBar` notarytool profile (override with `APPLE_KEYCHAIN_PROFILE`). The script checks both before tagging.
