---
name: release
description: Cut a new GitHub Release of kumpan-intra-recorder. Use when the user asks to "release", "ship a new version", "publish", or "make a release". Reads the latest tag, bumps it (patch by default), drafts a changelog from commits since that release, and then runs `pnpm release` which tags, builds the .dmg/.exe, and uploads via the gh CLI.
allowed-tools: Bash(git *) Bash(gh *) Bash(pnpm *) Bash(node -p *) Bash(node -e *) Read
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

If there are zero meaningful commits, warn the user — releasing means publishing identical bits — and ask if they want to proceed anyway.

### 4. Confirm with the user

Show:

- Latest release tag (or "none" if first)
- New version
- The drafted changelog markdown

Ask: "Proceed with `pnpm release <new-version>`? Reply: **go** / **edit version <vX.Y.Z>** / **edit changelog** / **cancel**."

Wait for explicit confirmation. Do not proceed on silence.

### 5. Execute the release

Run the existing script — it does the heavy lifting (tag, build, upload):

```
pnpm release <new-version> "$(cat <<'EOF'
## What's changed

<the formatted changelog>
EOF
)"
```

This takes ~5 minutes (electron-builder builds both macOS architectures + Windows portable .exe). Stream output so the user sees progress.

### 6. Report success

```
gh release view <new-version> --json url --jq '.url'
```

Show that URL plus the stable alias: `https://github.com/kumpan/kumpan-intra-recorder/releases/latest`

## Implementation notes

- **Don't re-implement `scripts/release.sh`.** It already handles the tag-is-at-HEAD case idempotently, builds both macOS archs + the Windows .exe, and uploads via `gh release create`. Your job is to compute the version + changelog and call the script.
- **Cross-compiling Windows from macOS works** because `signAndEditExecutable: false` skips the rcedit step that would otherwise need Wine. Don't set `SKIP_WINDOWS=1` unless the build genuinely fails on this machine.
- **If the build fails mid-way**, the tag and push may already be in place. Don't re-tag — just retry `pnpm release <new-version> "<notes>"` directly from a terminal once the failure is fixed.
- **First-release case**: if `gh release list` returns nothing, there's no previous tag to diff against. Use `git log --no-merges` for the full changelog. Default version is `v0.1.0`.
