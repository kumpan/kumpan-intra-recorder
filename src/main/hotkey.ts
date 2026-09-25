import { globalShortcut } from "electron"
import { getHotkey, updateHotkey } from "@/main/settings-store"
import { getRecorderState } from "@/main/recorder-session"
import {
  startRecordingFromTray,
  stopRecordingFromTray,
} from "@/main/recorder-controller"
import { refreshPanel } from "@/main/panel"

let registered: string | null = null

function onPress(): void {
  if (getRecorderState().kind === "recording") {
    stopRecordingFromTray()
  } else {
    void startRecordingFromTray()
  }
}

export function applyConfiguredHotkey(): { ok: boolean; message?: string } {
  const accelerator = getHotkey()
  if (registered) {
    globalShortcut.unregister(registered)
    registered = null
  }
  if (!accelerator) return { ok: true }

  try {
    const success = globalShortcut.register(accelerator, onPress)
    if (!success) {
      return { ok: false, message: `Could not register ${accelerator} — another app may own it.` }
    }
    registered = accelerator
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Invalid hotkey.",
    }
  }
}

export async function tryUpdateHotkey(
  next: string
): Promise<{ ok: boolean; hotkey: string; message?: string }> {
  const previous = getHotkey()
  await updateHotkey(next)
  const result = applyConfiguredHotkey()
  if (!result.ok) {
    await updateHotkey(previous)
    applyConfiguredHotkey()
    return { ok: false, hotkey: previous, message: result.message }
  }
  refreshPanel()
  return { ok: true, hotkey: next }
}

export function releaseHotkey(): void {
  if (registered) {
    globalShortcut.unregister(registered)
    registered = null
  }
}
