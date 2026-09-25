import { app, dialog } from "electron"
import { autoUpdater } from "electron-updater"
import { getRecorderState } from "@/main/recorder-session"
import { getPending } from "@/main/recording-handoff"

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let downloadedVersion: string | null = null

// Restarting mid-call or with an unsaved recording would lose it; the update then
// waits for the next quit instead.
function busy(): boolean {
  return getRecorderState().kind !== "idle" || getPending() !== null
}

async function offerRestart(version: string): Promise<void> {
  downloadedVersion = version
  if (busy()) return
  const { response } = await dialog.showMessageBox({
    type: "info",
    buttons: ["Restart Now", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "Update ready",
    message: `Kumpan Intra Recorder ${version} is ready to install.`,
    detail: "Restart now, or it installs the next time you quit the app.",
  })
  if (response === 0 && !busy()) autoUpdater.quitAndInstall(true, true)
}

function checkQuietly(): void {
  autoUpdater.checkForUpdates().catch(() => {})
}

export function startUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.on("update-downloaded", (info) => void offerRestart(info.version))
  // Without a listener EventEmitter throws; background failures (offline, the Windows
  // build not attached yet) are retried on the next tick anyway.
  autoUpdater.on("error", () => {})
  checkQuietly()
  setInterval(checkQuietly, CHECK_INTERVAL_MS)
}

export async function checkForUpdatesManually(): Promise<void> {
  if (!app.isPackaged) {
    await dialog.showMessageBox({
      message: "Updates only work in the packaged app.",
    })
    return
  }
  if (downloadedVersion && busy()) {
    await dialog.showMessageBox({
      type: "info",
      title: "Update ready",
      message: `Version ${downloadedVersion} installs the next time you quit.`,
      detail:
        "Finish the current recording first — restarting now would lose it.",
    })
    return
  }
  if (downloadedVersion) return offerRestart(downloadedVersion)
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result?.downloadPromise) {
      await dialog.showMessageBox({
        type: "info",
        title: "Update available",
        message: `Downloading Kumpan Intra Recorder ${result.updateInfo.version}…`,
        detail: "You'll be asked to restart once it's ready.",
      })
      return
    }
    await dialog.showMessageBox({
      type: "info",
      title: "No update",
      message: `You're on the latest version (${app.getVersion()}).`,
    })
  } catch (err) {
    await dialog.showMessageBox({
      type: "error",
      title: "Update check failed",
      message: "Couldn't check for updates.",
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
