import { app } from "electron"
import { autoUpdater } from "electron-updater"
import type { UpdateState } from "@/shared/types"
import { getRecorderState } from "@/main/recorder-session"
import { getPending } from "@/main/recording-handoff"
import { refreshPanel } from "@/main/panel"

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

let state: UpdateState = { kind: "idle" }

function setState(next: UpdateState): void {
  state = next
  refreshPanel()
}

export function getUpdateState(): UpdateState {
  return state
}

// Restarting mid-call or with an unsaved recording would lose it; the update then
// waits for the next quit instead.
function busy(): boolean {
  return getRecorderState().kind !== "idle" || getPending() !== null
}

export function startUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.on("update-available", (info) =>
    setState({ kind: "downloading", version: info.version })
  )
  autoUpdater.on("update-downloaded", (info) =>
    setState({ kind: "ready", version: info.version })
  )
  // Without a listener EventEmitter throws. A failed background check (offline, the
  // Windows build not attached yet) just retries next tick; a failed download is shown.
  autoUpdater.on("error", (err) => {
    if (state.kind === "downloading")
      setState({ kind: "error", message: err.message })
  })
  void checkForUpdates(false)
  setInterval(() => void checkForUpdates(false), CHECK_INTERVAL_MS)
}

export async function checkForUpdates(manual: boolean): Promise<void> {
  if (state.kind === "ready" || state.kind === "downloading") return
  if (!app.isPackaged) {
    if (manual)
      setState({
        kind: "error",
        message: "Updates only work in the packaged app.",
      })
    return
  }
  if (manual) setState({ kind: "checking" })
  try {
    const result = await autoUpdater.checkForUpdates()
    if (manual && !result?.downloadPromise) setState({ kind: "latest" })
  } catch (err) {
    if (manual)
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      })
  }
}

export function installUpdate(): void {
  if (state.kind !== "ready" || busy()) return
  autoUpdater.quitAndInstall(true, true)
}
