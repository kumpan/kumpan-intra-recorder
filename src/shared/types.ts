export type Settings = {
  baseUrl: string
  hasToken: boolean
  hotkey: string
  hotkeyDefault: string
}

export type SettingsUpdate = {
  baseUrl?: string
  token?: string | null
  hotkey?: string
}

export type HotkeyUpdateResult =
  | { ok: true; hotkey: string }
  | { ok: false; hotkey: string; message: string }

export type TokenTestResult =
  | { ok: true }
  | { ok: false; status?: number; message: string }

export type DesktopSource = {
  id: string
  name: string
}

export type RecorderState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "recording"; startedAt: string }
  | { kind: "stopping" }

export type RecordingResult = {
  sessionId: string
  filePath: string
  durationSeconds: number
  startedAt: string
  endedAt: string
  byteSize: number
}

export type RecorderStartPayload = {
  sessionId: string
  startedAt: string
}

export type RecorderChunkPayload = {
  sessionId: string
  data: ArrayBuffer
}

export type RecorderFinishPayload = {
  sessionId: string
  endedAt: string
}

export type RecorderFailedPayload = {
  sessionId: string | null
  message: string
}

export type UploadProgress = {
  sentBytes: number
  totalBytes: number
}

export type UploadOk = {
  ok: true
  status: number
  id: string
  viewUrl: string
}

export type UploadErr = {
  ok: false
  status: number
  message: string
}

export type UploadOutcome = UploadOk | UploadErr

export type SaveLocallyOutcome =
  | { ok: true; path: string }
  | { ok: false; canceled?: boolean; message?: string }
