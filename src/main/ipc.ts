import { ipcMain, shell } from "electron"
import { IpcChannel } from "@/shared/ipc"
import type {
  RecorderChunkPayload,
  RecorderFailedPayload,
  RecorderFinishPayload,
  RecorderStartPayload,
  RecordingResult,
  SaveLocallyOutcome,
  Settings,
  SettingsUpdate,
  TokenTestResult,
  UploadOutcome,
} from "@/shared/types"
import {
  DEFAULT_HOTKEY,
  getBaseUrl,
  getHotkey,
  getToken,
  hasToken,
  updateBaseUrl,
  updateToken,
} from "@/main/settings-store"
import { tryUpdateHotkey } from "@/main/hotkey"
import { closePostRecordingWindow, openSettingsWindow } from "@/main/windows"
import {
  handleAbort,
  handleChunk,
  handleFailed,
  handleFinish,
  handleStart,
} from "@/main/recorder-session"
import {
  discardPending,
  getPending,
  savePendingLocally,
  uploadPending,
} from "@/main/recording-handoff"

export function registerIpcHandlers(): void {
  const snapshot = (): Settings => ({
    baseUrl: getBaseUrl(),
    hasToken: hasToken(),
    hotkey: getHotkey(),
    hotkeyDefault: DEFAULT_HOTKEY,
  })

  ipcMain.handle(IpcChannel.GetSettings, (): Settings => snapshot())

  ipcMain.handle(
    IpcChannel.SetSettings,
    async (_event, update: SettingsUpdate): Promise<Settings> => {
      if (typeof update.baseUrl === "string") {
        await updateBaseUrl(update.baseUrl)
      }
      if (update.token !== undefined) {
        await updateToken(update.token)
      }
      if (typeof update.hotkey === "string") {
        const result = await tryUpdateHotkey(update.hotkey)
        if (!result.ok && result.message) {
          throw new Error(result.message)
        }
      }
      return snapshot()
    }
  )

  ipcMain.handle(IpcChannel.HasToken, (): boolean => hasToken())

  ipcMain.handle(IpcChannel.TestToken, async (): Promise<TokenTestResult> => {
    const token = getToken()
    if (!token) return { ok: false, message: "No token saved." }
    const url = `${getBaseUrl()}/api/transcripts/upload`
    try {
      const res = await fetch(url, {
        method: "HEAD",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) return { ok: false, status: 401, message: "Token rejected." }
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Network error.",
      }
    }
  })

  ipcMain.handle(IpcChannel.OpenSettings, (): void => {
    openSettingsWindow()
  })

  ipcMain.handle(IpcChannel.RecorderStart, (_event, payload: RecorderStartPayload): void => {
    handleStart(payload)
  })

  ipcMain.on(IpcChannel.RecorderChunk, (_event, payload: RecorderChunkPayload) => {
    handleChunk(payload)
  })

  ipcMain.handle(
    IpcChannel.RecorderFinish,
    async (_event, payload: RecorderFinishPayload): Promise<void> => {
      await handleFinish(payload)
    }
  )

  ipcMain.handle(IpcChannel.RecorderAbort, async (_event, reason: string): Promise<void> => {
    await handleAbort(reason)
  })

  ipcMain.on(IpcChannel.RecorderFailed, (_event, payload: RecorderFailedPayload) => {
    handleFailed(payload)
  })

  ipcMain.handle(IpcChannel.HandoffGetPending, (): RecordingResult | null => {
    return getPending()
  })

  ipcMain.handle(IpcChannel.HandoffUpload, async (): Promise<UploadOutcome> => {
    return uploadPending()
  })

  ipcMain.handle(
    IpcChannel.HandoffSaveLocally,
    async (): Promise<SaveLocallyOutcome> => savePendingLocally()
  )

  ipcMain.handle(IpcChannel.HandoffDiscard, async (): Promise<void> => {
    await discardPending()
  })

  ipcMain.handle(IpcChannel.HandoffCloseWindow, (): void => {
    closePostRecordingWindow()
  })

  ipcMain.handle(IpcChannel.OpenExternal, async (_event, url: string): Promise<void> => {
    if (typeof url !== "string") return
    if (!/^https?:\/\//i.test(url)) return
    await shell.openExternal(url)
  })
}
