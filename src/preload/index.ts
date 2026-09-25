import { contextBridge, ipcRenderer } from "electron"
import { IpcChannel } from "@/shared/ipc"
import type {
  AudioActivityPayload,
  MeetingBannerContext,
  PanelState,
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
  UploadProgress,
} from "@/shared/types"

const api = {
  getSettings: (): Promise<Settings> =>
    ipcRenderer.invoke(IpcChannel.GetSettings),
  setSettings: (update: SettingsUpdate): Promise<Settings> =>
    ipcRenderer.invoke(IpcChannel.SetSettings, update),
  hasToken: (): Promise<boolean> => ipcRenderer.invoke(IpcChannel.HasToken),
  testToken: (): Promise<TokenTestResult> =>
    ipcRenderer.invoke(IpcChannel.TestToken),

  openSettings: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.OpenSettings),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.OpenExternal, url),

  resetScreenRecording: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannel.ResetScreenRecording),

  meeting: {
    getContext: (): Promise<MeetingBannerContext | null> =>
      ipcRenderer.invoke(IpcChannel.MeetingBannerContext),
    accept: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.MeetingBannerAccept),
    dismiss: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.MeetingBannerDismiss),
    onContext: (cb: (context: MeetingBannerContext) => void): (() => void) => {
      const listener = (
        _e: Electron.IpcRendererEvent,
        context: MeetingBannerContext
      ) => cb(context)
      ipcRenderer.on(IpcChannel.MeetingBannerUpdate, listener)
      return () =>
        ipcRenderer.removeListener(IpcChannel.MeetingBannerUpdate, listener)
    },
  },

  recorder: {
    start: (payload: RecorderStartPayload): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.RecorderStart, payload),
    sendChunk: (payload: RecorderChunkPayload): void => {
      ipcRenderer.send(IpcChannel.RecorderChunk, payload)
    },
    finish: (payload: RecorderFinishPayload): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.RecorderFinish, payload),
    abort: (reason: string): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.RecorderAbort, reason),
    reportFailure: (payload: RecorderFailedPayload): void => {
      ipcRenderer.send(IpcChannel.RecorderFailed, payload)
    },
    reportAudioActivity: (payload: AudioActivityPayload): void => {
      ipcRenderer.send(IpcChannel.RecorderAudioActivity, payload)
    },
    onCommandStart: (cb: () => void): (() => void) => {
      const listener = () => cb()
      ipcRenderer.on(IpcChannel.RecorderCommandStart, listener)
      return () =>
        ipcRenderer.removeListener(IpcChannel.RecorderCommandStart, listener)
    },
    onCommandStop: (cb: () => void): (() => void) => {
      const listener = () => cb()
      ipcRenderer.on(IpcChannel.RecorderCommandStop, listener)
      return () =>
        ipcRenderer.removeListener(IpcChannel.RecorderCommandStop, listener)
    },
  },

  handoff: {
    getPending: (): Promise<RecordingResult | null> =>
      ipcRenderer.invoke(IpcChannel.HandoffGetPending),
    upload: (): Promise<UploadOutcome> =>
      ipcRenderer.invoke(IpcChannel.HandoffUpload),
    saveLocally: (): Promise<SaveLocallyOutcome> =>
      ipcRenderer.invoke(IpcChannel.HandoffSaveLocally),
    discard: (): Promise<void> => ipcRenderer.invoke(IpcChannel.HandoffDiscard),
    onUploadProgress: (cb: (p: UploadProgress) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, p: UploadProgress) =>
        cb(p)
      ipcRenderer.on(IpcChannel.HandoffUploadProgress, listener)
      return () =>
        ipcRenderer.removeListener(IpcChannel.HandoffUploadProgress, listener)
    },
  },

  panel: {
    getState: (): Promise<PanelState> =>
      ipcRenderer.invoke(IpcChannel.PanelGetState),
    onState: (cb: (state: PanelState) => void): (() => void) => {
      const listener = (_e: Electron.IpcRendererEvent, state: PanelState) =>
        cb(state)
      ipcRenderer.on(IpcChannel.PanelStateChanged, listener)
      return () =>
        ipcRenderer.removeListener(IpcChannel.PanelStateChanged, listener)
    },
    resize: (height: number): void => {
      ipcRenderer.send(IpcChannel.PanelResize, height)
    },
    startRecording: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.PanelStartRecording),
    stopRecording: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.PanelStopRecording),
    checkForUpdates: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.PanelCheckForUpdates),
    installUpdate: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.PanelInstallUpdate),
    quit: (): Promise<void> => ipcRenderer.invoke(IpcChannel.PanelQuit),
  },
}

export type RecorderApi = typeof api

contextBridge.exposeInMainWorld("api", api)
