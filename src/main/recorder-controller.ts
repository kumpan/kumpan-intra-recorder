import { dialog } from "electron"
import {
  getRecorderState,
  requestStart,
  requestStop,
} from "@/main/recorder-session"
import {
  closeRecorderWindow,
  ensureRecorderWindow,
  getRecorderWindow,
  openPostRecordingWindow,
} from "@/main/windows"
import { setPending } from "@/main/recording-handoff"
import {
  ensureMicrophoneAccess,
  showScreenRecordingHelpDialog,
} from "@/main/permissions"

export async function startRecordingFromTray(): Promise<void> {
  if (getRecorderState().kind !== "idle") return

  if (!(await ensureMicrophoneAccess())) return

  const window = await ensureRecorderWindow()
  requestStart(window, (outcome) => {
    closeRecorderWindow()
    if (outcome.ok) {
      const post = openPostRecordingWindow()
      setPending(outcome.result, post)
    } else {
      void handleStartFailure(outcome.message)
    }
  })
}

async function handleStartFailure(message: string): Promise<void> {
  if (looksLikeScreenPermissionError(message)) {
    await showScreenRecordingHelpDialog("blocked", message)
    return
  }
  dialog.showErrorBox("Recording failed", message)
}

function looksLikeScreenPermissionError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("notallowed") ||
    m.includes("permission denied") ||
    m.includes("permission") ||
    m.includes("not allowed") ||
    m.includes("could not start audio source") ||
    m.includes("notreadable") ||
    m.includes("notfound") ||
    m.includes("no audio track") ||
    m.includes("getdisplaymedia") ||
    m.includes("get sources") ||
    m.includes("display")
  )
}

export function stopRecordingFromTray(): void {
  const window = getRecorderWindow()
  if (!window) return
  requestStop(window)
}
