import { useEffect, useState } from "react"
import type {
  RecordingResult,
  UploadOutcome,
  UploadProgress,
} from "@/shared/types"

type View =
  | { kind: "loading" }
  | { kind: "ready"; result: RecordingResult }
  | { kind: "uploading"; result: RecordingResult; progress: UploadProgress }
  | { kind: "uploaded"; viewUrl: string }
  | { kind: "upload-failed"; result: RecordingResult; message: string }
  | { kind: "saving"; result: RecordingResult }
  | { kind: "saved"; path: string }
  | { kind: "discarded" }

export function PostRecording({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ kind: "loading" })

  useEffect(() => {
    window.api.handoff.getPending().then((result) => {
      if (!result) {
        setView({ kind: "discarded" })
        return
      }
      setView({ kind: "ready", result })
    })

    const offProgress = window.api.handoff.onUploadProgress((progress) => {
      setView((current) =>
        current.kind === "uploading"
          ? { ...current, progress }
          : current
      )
    })
    return offProgress
  }, [])

  const onUpload = async () => {
    if (view.kind !== "ready" && view.kind !== "upload-failed") return
    const result = view.result
    setView({
      kind: "uploading",
      result,
      progress: { sentBytes: 0, totalBytes: result.byteSize },
    })
    const outcome: UploadOutcome = await window.api.handoff.upload()
    if (outcome.ok) {
      setView({ kind: "uploaded", viewUrl: outcome.viewUrl })
    } else {
      setView({ kind: "upload-failed", result, message: outcome.message })
    }
  }

  const onSave = async () => {
    if (view.kind !== "ready" && view.kind !== "upload-failed") return
    setView({ kind: "saving", result: view.result })
    const outcome = await window.api.handoff.saveLocally()
    if (outcome.ok) {
      setView({ kind: "saved", path: outcome.path })
    } else if (outcome.canceled) {
      setView({ kind: "ready", result: view.result })
    } else {
      setView({
        kind: "upload-failed",
        result: view.result,
        message: outcome.message ?? "Failed to save.",
      })
    }
  }

  const onDiscard = async () => {
    await window.api.handoff.discard()
    onClose()
  }

  return (
    <section className="handoff">
      <Body view={view} onUpload={onUpload} onSave={onSave} onDiscard={onDiscard} onClose={onClose} />
    </section>
  )
}

type BodyProps = {
  view: View
  onUpload: () => void
  onSave: () => void
  onDiscard: () => void
  onClose: () => void
}

function Body({ view, onUpload, onSave, onDiscard, onClose }: BodyProps) {
  switch (view.kind) {
    case "loading":
      return <p className="status">Loading…</p>

    case "ready":
    case "upload-failed":
      return (
        <>
          <Header
            title="Recording finished"
            subtitle={summary(view.result)}
          />
          {view.kind === "upload-failed" && (
            <p className="status status--error">{view.message}</p>
          )}
          <div className="handoff__actions">
            <button type="button" className="primary" onClick={onUpload}>
              {view.kind === "upload-failed" ? "Retry upload" : "Upload to intra"}
            </button>
            <div className="handoff__actions-row">
              <button type="button" onClick={onSave}>
                Save locally
              </button>
              <button type="button" className="danger" onClick={onDiscard}>
                Discard
              </button>
            </div>
          </div>
        </>
      )

    case "uploading": {
      const percent =
        view.progress.totalBytes > 0
          ? Math.min(100, (view.progress.sentBytes / view.progress.totalBytes) * 100)
          : 0
      return (
        <>
          <Header
            title="Uploading…"
            subtitle={`${formatBytes(view.progress.sentBytes)} / ${formatBytes(view.progress.totalBytes)}`}
          />
          <div className="progress">
            <div className="progress__bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="status">{percent.toFixed(0)}%</p>
        </>
      )
    }

    case "uploaded":
      return (
        <>
          <Header title="Uploaded" subtitle="The recording is now in intra." />
          <div className="handoff__actions">
            <button
              type="button"
              className="primary"
              onClick={() => window.api.openExternal(view.viewUrl)}
            >
              Open in intra
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )

    case "saving":
      return (
        <>
          <Header title="Saving…" subtitle={summary(view.result)} />
          <p className="status">Choose a destination in the save dialog.</p>
        </>
      )

    case "saved":
      return (
        <>
          <Header title="Saved" subtitle={view.path} />
          <div className="handoff__actions">
            <button type="button" className="primary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )

    case "discarded":
      return (
        <>
          <Header title="No recording" subtitle="Nothing to do here." />
          <div className="handoff__actions">
            <button type="button" className="primary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )
  }
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="handoff__header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  )
}

function summary(result: RecordingResult): string {
  return `${formatDuration(result.durationSeconds)} · ${formatBytes(result.byteSize)}`
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, "0")}s`
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`
  return `${s}s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
