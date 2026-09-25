import { app, clipboard, dialog, shell, systemPreferences } from "electron"
import { exec as execCb } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execCb)

const SCREEN_PREFS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
const MIC_PREFS_URL =
  "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
const BUNDLE_ID = "se.kumpan.intra.recorder"
const TCC_RESET_COMMAND = `tccutil reset ScreenCapture ${BUNDLE_ID}`

export async function resetScreenRecordingTcc(): Promise<{ ok: boolean; message: string }> {
  if (process.platform !== "darwin") {
    return { ok: false, message: "macOS only." }
  }
  try {
    await exec(TCC_RESET_COMMAND)
    return { ok: true, message: "Reset succeeded." }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "tccutil failed.",
    }
  }
}

export async function resetAndQuitForScreenRecording(): Promise<void> {
  const result = await resetScreenRecordingTcc()
  if (result.ok) {
    await dialog.showMessageBox({
      type: "info",
      buttons: ["Quit Now"],
      defaultId: 0,
      title: "Permission reset",
      message: `${appLabel()} will now quit.`,
      detail:
        "Reopen the app from Applications, click Start Recording, and macOS will ask for " +
        "Screen Recording permission with a fresh entry. Grant it, then macOS will offer " +
        "“Quit & Reopen” — accept that and recording will work.",
    })
    app.quit()
    return
  }
  clipboard.writeText(TCC_RESET_COMMAND)
  await dialog.showMessageBox({
    type: "error",
    buttons: ["OK"],
    defaultId: 0,
    title: "Couldn't reset automatically",
    message: "Run the reset command yourself in Terminal.",
    detail:
      `It has been copied to your clipboard:\n\n  ${TCC_RESET_COMMAND}\n\n` +
      `Paste it into Terminal, press Return, then reopen ${appLabel()} and grant access ` +
      `when macOS asks. (Underlying error: ${result.message})`,
  })
}

function appLabel(): string {
  return app.isPackaged ? "Kumpan Intra Recorder" : "Electron"
}

export async function ensureMicrophoneAccess(): Promise<boolean> {
  if (process.platform !== "darwin") return true
  const status = systemPreferences.getMediaAccessStatus("microphone")
  if (status === "granted") return true
  if (status === "not-determined") {
    const granted = await systemPreferences.askForMediaAccess("microphone")
    if (granted) return true
  }
  const result = await dialog.showMessageBox({
    type: "warning",
    buttons: ["Open Settings", "Cancel"],
    defaultId: 0,
    cancelId: 1,
    title: "Microphone access needed",
    message: `${appLabel()} can't record your voice without Microphone access.`,
    detail:
      `Open System Settings → Privacy & Security → Microphone and turn on ${appLabel()}, ` +
      "then come back and start the recording again.",
  })
  if (result.response === 0) {
    await shell.openExternal(MIC_PREFS_URL)
  }
  return false
}

export async function showScreenRecordingHelpDialog(
  reason: "first-time" | "blocked",
  detail?: string
): Promise<void> {
  const isFirstTime = reason === "first-time"

  const message = isFirstTime
    ? `${appLabel()} needs your permission to record meeting audio.`
    : `${appLabel()} couldn't capture system audio — macOS denied or returned no screen source.`

  const body = isFirstTime
    ? [
        "1. Click Open Settings below.",
        `2. Turn on ${appLabel()} under Screen & System Audio Recording.`,
        `3. Quit and reopen ${appLabel()} (macOS only applies the permission after a relaunch).`,
        "",
        "Then start the recording again from the menu bar.",
      ]
    : [
        "macOS is denying the recording even though the toggle in Settings is on.",
        "",
        "This usually follows an upgrade from an old unsigned version: macOS keeps",
        "a permission entry that no longer matches the app, and toggling off/on",
        "rewrites the same broken entry.",
        "",
        "Recommended fix:",
        `  • Click "Reset & Quit". The app will run \`${TCC_RESET_COMMAND}\``,
        "    for you, then quit.",
        `  • Reopen ${appLabel()} from Applications.`,
        "  • Click Start Recording — macOS will ask for fresh permission.",
        "  • Grant it and accept the “Quit & Reopen” prompt that follows.",
      ]
  if (detail) {
    body.push("")
    body.push(`(Details: ${detail})`)
  }

  const buttons = isFirstTime
    ? ["Open Settings", "Quit and reopen later", "Cancel"]
    : ["Reset & Quit (recommended)", "Open Settings", "Quit", "Cancel"]
  const cancelId = buttons.length - 1

  const result = await dialog.showMessageBox({
    type: "info",
    buttons,
    defaultId: 0,
    cancelId,
    title: "Screen Recording access needed",
    message,
    detail: body.join("\n"),
  })

  const label = buttons[result.response]
  if (label === "Reset & Quit (recommended)") {
    await resetAndQuitForScreenRecording()
  } else if (label === "Open Settings") {
    await shell.openExternal(SCREEN_PREFS_URL)
  } else if (label === "Quit" || label === "Quit and reopen later") {
    app.quit()
  }
}
