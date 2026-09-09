---
name: release
description: Cut a new GitHub Release of kumpan-intra-recorder. Use when the user asks to "release", "ship a new version", "publish", or "make a release". Reads the latest tag, bumps it (patch by default), drafts a changelog from commits since that release, and then runs `pnpm release` which tags, builds the macOS .dmg(s), and uploads via the gh CLI. The Windows .exe is built separately by CI and attaches itself to the published release.
allowed-tools: Bash(git *) Bash(gh *) Bash(pnpm *) Bash(node -p *) Bash(node -e *) Bash(rm -rf dist*) Read Write
---

# Release

Cut a new GitHub Release of kumpan-intra-recorder.

## Arguments

The user's invocation may include one of:

- `patch` (default if absent) — bump Z in vX.Y.Z
- `minor` — bump Y, reset Z to 0
- `major` — bump X, reset Y and Z to 0
- explicit `vX.Y.Z` — use as-is

## Preconditions — run all, bail if any fails

1. `git status --porcelain` is empty (no uncommitted changes)
2. `git rev-parse --abbrev-ref HEAD` returns `main`
3. `gh auth status` exits 0
4. Working directory is the repo root (look for `package.json` + `electron-builder.yml`)

If any fail, explain to the user and stop.

## Procedure

### 1. Find the latest release

```
gh release list --limit 1 --json tagName --jq '.[0].tagName'
```

If empty (no prior releases), the new version defaults to `v0.1.0` and the changelog covers all commits.

### 2. Compute the new version

Parse the latest tag as `vX.Y.Z`. Apply the bump:

- `patch` → `v<X>.<Y>.<Z+1>`
- `minor` → `v<X>.<Y+1>.0`
- `major` → `v<X+1>.0.0`
- explicit → use directly, validate `^v\d+\.\d+\.\d+$`

### 3. Build the changelog

```
git log <latest-tag>..HEAD --no-merges --pretty=format:'%s'
```

(If there is no prior tag, use `git log --no-merges --pretty=format:'%s'`.)

Clean each subject line:

- Drop `Co-Authored-By:` / `Signed-off-by:` trailers if they appear as standalone subjects
- Drop noise: lone `wip`, `fixup!`, `squash!`, `bump version`, mechanical merges
- If the line starts with a conventional prefix (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `style:`, `perf:`, `test:`), strip the prefix and group accordingly
- Cap at ~15 bullets total; collapse the rest into "…and N other small improvements"

Output as markdown:

```markdown
## What's changed

### Features
- new thing

### Fixes
- fixed thing

### Changes
- everything else
```

Skip empty sections.

Then append the install block below **verbatim**. The app is unsigned, so every release
hits the same two macOS walls, and readers are non-technical colleagues who will file it
as "the app is broken" otherwise:

````markdown
## Installing

**Pick your file:** Apple Silicon Mac → `-arm64.dmg`. Intel Mac → `-x64.dmg`. Windows → the `.exe`.

### macOS — required one-time step

Open the dmg, drag the app to **Applications**, then run this once in Terminal:

```
xattr -dr com.apple.quarantine "/Applications/Kumpan Intra Recorder.app"
```

Without it macOS refuses to open the app and claims it **"is damaged and can't be opened"**. The file is fine — that's Gatekeeper rejecting an unsigned download, and on Apple Silicon it gives you no "open anyway" button. Right-click → Open does *not* get around it. The command just strips the "downloaded from the internet" flag.

### macOS — after every update

Because the app is unsigned, macOS treats each new version as a different program and revokes the Screen Recording permission you granted last time. Open the tray menu → **Reset Screen Recording permission…**, reopen the app from Applications, press **Start Recording** once, and grant access when macOS asks.

The meeting banner stays silent until that permission is back — deliberately, so it never springs an OS prompt on you mid-call. Re-grant it and the banner appears within about 12 seconds of joining a call.

### Windows

Run the `.exe`. SmartScreen will warn — click **More info** → **Run anyway**.
````

If there are zero meaningful commits, warn the user — releasing means publishing identical bits — and ask if they want to proceed anyway.

### 4. Confirm with the user

Show:

- Latest release tag (or "none" if first)
- New version
- The drafted changelog markdown

Ask: "Proceed with `pnpm release <new-version>`? Reply: **go** / **edit version <vX.Y.Z>** / **edit changelog** / **cancel**."

Wait for explicit confirmation. Do not proceed on silence.

### 5. Execute the release

**Write the changelog to a temp file first — never pass it inline as a second argument.** Multi-line markdown with backticks (e.g. \`pnpm release\`) gets mangled when bash command strings are serialized by upstream tools: the heredoc may be flattened and backticks then execute as commands, polluting the release body with shell output. A file is parsed verbatim by `gh release create --notes-file`.

Use the Write tool (not a Bash heredoc) to create `/tmp/release-notes.md` containing exactly the markdown changelog you drafted. Then run:

```
RELEASE_NOTES_FILE=/tmp/release-notes.md pnpm release <new-version>
```

This takes ~3 minutes (electron-builder builds both macOS architectures). Stream output so the user sees progress.

The Windows .exe is not built here — publishing the release triggers
`.github/workflows/windows-release.yml`, which builds it on a Windows runner and
attaches it within a few minutes. Tell the user it is still in flight, and give them the
watch command the script prints. If they need it now, check on it:

```
gh run list --workflow windows-release.yml --limit 1
```

### 6. Report success

```
gh release view <new-version> --json url --jq '.url'
```

Show that URL plus the stable alias: `https://github.com/kumpan/kumpan-intra-recorder/releases/latest`

## Implementation notes

- **Don't re-implement `scripts/release.sh`.** It already handles the tag-is-at-HEAD case idempotently, builds both macOS archs, and uploads via `gh release create`. Your job is to compute the version + changelog and call the script.
- **Windows cannot be cross-compiled from an Apple Silicon Mac.** The `portable` target needs electron-builder's bundled `makensis`, which ships Intel-only, so spawning it without Rosetta fails with `Unknown system error -86` (EBADARCH) — and Apple removes Rosetta in macOS 28. That is why the .exe moved to a Windows CI runner. Don't add a local `pnpm dist:win` step back into the release path.
- **If the build fails mid-way**, the tag and push may already be in place. Don't re-tag — just retry `pnpm release <new-version> "<notes>"` directly from a terminal once the failure is fixed.
- **First-release case**: if `gh release list` returns nothing, there's no previous tag to diff against. Use `git log --no-merges` for the full changelog. Default version is `v0.1.0`.
