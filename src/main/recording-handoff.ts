import { BrowserWindow, dialog } from "electron"
import { copyFile, rm } from "node:fs/promises"
import { basename } from "node:path"
import { IpcChannel } from "@/shared/ipc"
import type {
  RecordingResult,
  SaveLocallyOutcome,
  TranscriptLanguage,
  UploadOutcome,
  UploadProgress,
} from "@/shared/types"
import {
  getBaseUrl,
  getToken,
  updateTranscriptLanguage,
} from "@/main/settings-store"
import { uploadRecording } from "@/main/upload"
import { refreshPanel } from "@/main/panel"

// A queue, not a slot: a recording started (hotkey, banner) before the previous one was
// uploaded or saved must not replace it, and an upload finishing late must clear only
// its own recording. Every action names the session it means.
let queue: RecordingResult[] = []
let host: BrowserWindow | null = null

export function setPending(result: RecordingResult, window: BrowserWindow): void {
  queue = [...queue, result]
  host = window
  refreshPanel()
}

export function getPending(): RecordingResult | null {
  return queue[0] ?? null
}

function find(sessionId: string): RecordingResult | null {
  return queue.find((r) => r.sessionId === sessionId) ?? null
}

function clear(sessionId: string): void {
  queue = queue.filter((r) => r.sessionId !== sessionId)
  refreshPanel()
}

export async function discardPending(sessionId: string): Promise<void> {
  const current = find(sessionId)
  if (!current) return
  clear(sessionId)
  await rm(current.filePath, { force: true })
}

export async function savePendingLocally(
  sessionId: string
): Promise<SaveLocallyOutcome> {
  const current = find(sessionId)
  if (!current) return { ok: false, message: "This recording is no longer pending." }
  // Free-standing, not a sheet: the host is the small tray panel.
  const dialogResult = await dialog.showSaveDialog({
    title: "Save recording",
    defaultPath: basename(current.filePath),
    filters: [{ name: "WebM Audio", extensions: ["webm"] }],
  })
  if (dialogResult.canceled || !dialogResult.filePath) {
    return { ok: false, canceled: true }
  }
  try {
    await copyFile(current.filePath, dialogResult.filePath)
    await rm(current.filePath, { force: true })
    clear(sessionId)
    return { ok: true, path: dialogResult.filePath }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to save file.",
    }
  }
}

export async function uploadPending(
  sessionId: string,
  language: TranscriptLanguage
): Promise<UploadOutcome> {
  const current = find(sessionId)
  if (!current) {
    return { ok: false, status: 0, message: "This recording is no longer pending." }
  }
  const token = getToken()
  if (!token) {
    return {
      ok: false,
      status: 0,
      message: "No API token saved. Set one in Settings.",
    }
  }

  // The choice becomes the default for the next recording.
  await updateTranscriptLanguage(language)
  const target = host
  try {
    const result = await uploadRecording({
      baseUrl: getBaseUrl(),
      token,
      filePath: current.filePath,
      durationSeconds: current.durationSeconds,
      startedAt: current.startedAt,
      endedAt: current.endedAt,
      language,
      onProgress: (p: UploadProgress) => {
        if (target && !target.isDestroyed()) {
          target.webContents.send(IpcChannel.HandoffUploadProgress, p)
        }
      },
    })
    if (result.ok) {
      await rm(current.filePath, { force: true })
      clear(sessionId)
    }
    return result
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: err instanceof Error ? err.message : "Upload failed.",
    }
  }
}
