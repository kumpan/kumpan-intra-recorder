import { app, desktopCapturer, dialog, session } from "electron"
import { createTray, rebuildTrayMenu } from "@/main/tray"
import { registerIpcHandlers } from "@/main/ipc"
import { loadSettings } from "@/main/settings-store"
import { openSettingsWindow, closeRecorderWindow } from "@/main/windows"
import { handleAbort } from "@/main/recorder-session"
import { applyConfiguredHotkey, releaseHotkey } from "@/main/hotkey"

if (process.platform === "darwin") {
  app.dock?.hide()
}

function isExpectedDisplayMediaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const m = message.toLowerCase()
  return (
    m.includes("failed to get sources") ||
    m.includes("no screen sources") ||
    m.includes("video was requested") ||
    m.includes("no audio stream was provided")
  )
}

function reportFatal(scope: string, err: unknown): void {
  if (isExpectedDisplayMediaError(err)) {
    console.error(`[${scope}] suppressed display-media error:`, err)
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  console.error(`[${scope}]`, err)
  if (app.isReady()) {
    dialog.showErrorBox(`Kumpan Recorder — unexpected error`, message)
  }
  void handleAbort(`Fatal error in ${scope}.`).catch(() => {})
  closeRecorderWindow()
}

process.on("uncaughtException", (err) => reportFatal("uncaughtException", err))
process.on("unhandledRejection", (err) => reportFatal("unhandledRejection", err))

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

app.on("second-instance", () => {
  openSettingsWindow()
})

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === "media" || permission === "display-capture") return callback(true)
    callback(false)
  })

  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 0, height: 0 },
        fetchWindowIcons: false,
      })
      const first = sources[0]
      if (!first) {
        throw new Error(
          "macOS reported no screen sources. Toggle Screen Recording off/on for this app and relaunch."
        )
      }
      callback({ video: first, audio: "loopback" })
    },
    { useSystemPicker: false }
  )

  registerIpcHandlers()
  createTray()

  await loadSettings()
  rebuildTrayMenu()

  const hotkey = applyConfiguredHotkey()
  if (!hotkey.ok && hotkey.message) {
    console.warn("[hotkey]", hotkey.message)
  }
})

app.on("will-quit", () => {
  releaseHotkey()
})

app.on("window-all-closed", () => {
  // tray-only app; do not quit when the settings window closes
})
