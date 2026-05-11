import { BrowserWindow, dialog } from "electron"
import { copyFile, rm } from "node:fs/promises"
import { basename } from "node:path"
import { IpcChannel } from "@/shared/ipc"
import type {
  RecordingResult,
  SaveLocallyOutcome,
  UploadOutcome,
  UploadProgress,
} from "@/shared/types"
import { getBaseUrl, getToken } from "@/main/settings-store"
import { uploadRecording } from "@/main/upload"

let pending: RecordingResult | null = null
let host: BrowserWindow | null = null
let uploading = false

export function setPending(result: RecordingResult, window: BrowserWindow): void {
  pending = result
  host = window
}

export function getPending(): RecordingResult | null {
  return pending
}

export function isUploading(): boolean {
  return uploading
}

function clear(): void {
  pending = null
  host = null
}

export async function discardPending(): Promise<void> {
  const current = pending
  clear()
  if (current) await rm(current.filePath, { force: true })
}

export async function savePendingLocally(): Promise<SaveLocallyOutcome> {
  if (!pending) return { ok: false, message: "No recording pending." }
  const parent = host ?? undefined
  const dialogResult = parent
    ? await dialog.showSaveDialog(parent, {
        title: "Save recording",
        defaultPath: basename(pending.filePath),
        filters: [{ name: "WebM Audio", extensions: ["webm"] }],
      })
    : await dialog.showSaveDialog({
        title: "Save recording",
        defaultPath: basename(pending.filePath),
        filters: [{ name: "WebM Audio", extensions: ["webm"] }],
      })
  if (dialogResult.canceled || !dialogResult.filePath) {
    return { ok: false, canceled: true }
  }
  try {
    await copyFile(pending.filePath, dialogResult.filePath)
    await rm(pending.filePath, { force: true })
    const saved = dialogResult.filePath
    clear()
    return { ok: true, path: saved }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Failed to save file.",
    }
  }
}

export async function uploadPending(): Promise<UploadOutcome> {
  if (!pending) return { ok: false, status: 0, message: "No recording pending." }
  const token = getToken()
  if (!token) {
    return {
      ok: false,
      status: 0,
      message: "No API token saved. Set one in Settings.",
    }
  }

  uploading = true
  const target = host
  const current = pending

  const result = await uploadRecording({
    baseUrl: getBaseUrl(),
    token,
    filePath: current.filePath,
    durationSeconds: current.durationSeconds,
    startedAt: current.startedAt,
    endedAt: current.endedAt,
    onProgress: (p: UploadProgress) => {
      if (target && !target.isDestroyed()) {
        target.webContents.send(IpcChannel.HandoffUploadProgress, p)
      }
    },
  })

  uploading = false

  if (result.ok) {
    await rm(current.filePath, { force: true })
    clear()
  }

  return result
}
