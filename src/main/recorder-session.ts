import { app, BrowserWindow } from "electron"
import { createWriteStream, type WriteStream } from "node:fs"
import { rm } from "node:fs/promises"
import { join } from "node:path"
import { IpcChannel } from "@/shared/ipc"
import type {
  RecorderChunkPayload,
  RecorderFailedPayload,
  RecorderFinishPayload,
  RecorderStartPayload,
  RecorderState,
  RecordingResult,
} from "@/shared/types"

type ActiveSession = {
  id: string
  filePath: string
  stream: WriteStream
  startedAtIso: string
  startedAtMs: number
  byteSize: number
}

type StateListener = (state: RecorderState) => void
type CompletionListener = (
  result: { ok: true; result: RecordingResult } | { ok: false; message: string }
) => void

let state: RecorderState = { kind: "idle" }
let active: ActiveSession | null = null
let stateListeners: StateListener[] = []
let completionListener: CompletionListener | null = null

function setState(next: RecorderState): void {
  state = next
  for (const listener of stateListeners) listener(state)
}

export function getRecorderState(): RecorderState {
  return state
}

export function onRecorderState(listener: StateListener): () => void {
  stateListeners.push(listener)
  return () => {
    stateListeners = stateListeners.filter((l) => l !== listener)
  }
}

export function beginStarting(): void {
  setState({ kind: "starting" })
}

export function handleStart(payload: RecorderStartPayload): void {
  if (active) {
    throw new Error("A recording is already in progress.")
  }
  const filePath = join(
    app.getPath("temp"),
    `kumpan-recording-${payload.startedAt.replace(/[:.]/g, "-")}.webm`
  )
  const stream = createWriteStream(filePath)
  active = {
    id: payload.sessionId,
    filePath,
    stream,
    startedAtIso: payload.startedAt,
    startedAtMs: Date.parse(payload.startedAt),
    byteSize: 0,
  }
  setState({ kind: "recording", startedAt: payload.startedAt })
}

export function handleChunk(payload: RecorderChunkPayload): void {
  if (!active || active.id !== payload.sessionId) return
  const buf = Buffer.from(payload.data)
  active.byteSize += buf.byteLength
  active.stream.write(buf)
}

export async function handleFinish(payload: RecorderFinishPayload): Promise<void> {
  if (!active || active.id !== payload.sessionId) return
  const session = active
  active = null
  setState({ kind: "stopping" })

  await new Promise<void>((resolve, reject) => {
    session.stream.end((err?: NodeJS.ErrnoException | null) => {
      if (err) reject(err)
      else resolve()
    })
  })

  const endedAtMs = Date.parse(payload.endedAt)
  const result: RecordingResult = {
    sessionId: session.id,
    filePath: session.filePath,
    durationSeconds: Math.max(0, Math.round((endedAtMs - session.startedAtMs) / 1000)),
    startedAt: session.startedAtIso,
    endedAt: payload.endedAt,
    byteSize: session.byteSize,
  }
  setState({ kind: "idle" })
  completionListener?.({ ok: true, result })
  completionListener = null
}

export async function handleAbort(reason: string): Promise<void> {
  const session = active
  active = null
  if (session) {
    await new Promise<void>((resolve) => session.stream.end(() => resolve()))
    await rm(session.filePath, { force: true })
  }
  setState({ kind: "idle" })
  completionListener?.({ ok: false, message: reason })
  completionListener = null
}

export function handleFailed(payload: RecorderFailedPayload): void {
  void handleAbort(payload.message)
}

export function requestStart(
  window: BrowserWindow,
  onComplete: CompletionListener
): void {
  if (state.kind !== "idle") {
    onComplete({ ok: false, message: "Recorder is busy." })
    return
  }
  completionListener = onComplete
  beginStarting()
  window.webContents.send(IpcChannel.RecorderCommandStart)
}

export function requestStop(window: BrowserWindow): void {
  if (state.kind !== "recording") return
  window.webContents.send(IpcChannel.RecorderCommandStop)
}
