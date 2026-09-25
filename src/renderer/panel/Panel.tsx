import { useEffect, useRef, useState } from "react"
import type { PanelState, RecorderState, UpdateState } from "@/shared/types"
import { PostRecording } from "@/renderer/post-recording/PostRecording"
import { Settings } from "@/renderer/components/Settings"
import { formatForDisplay } from "@/renderer/components/HotkeyField"

const isMac = /Mac/.test(navigator.platform)

export function Panel() {
  const [state, setState] = useState<PanelState | null>(null)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.api.panel.getState().then(setState)
    return window.api.panel.onState(setState)
  }, [])

  // The handoff opens with a new recording and stays after Upload / Save clears it
  // in main, so the outcome ("Open in intra") is still there until the user closes it.
  const pendingId = state?.pending?.sessionId
  useEffect(() => {
    if (pendingId) setHandoffOpen(true)
  }, [pendingId])

  // Reopened from the tray, the panel starts on the recorder, not wherever it was left.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") setSettingsOpen(false)
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  // The window is sized to the content, not the other way round.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const observer = new ResizeObserver(() =>
      window.api.panel.resize(el.offsetHeight)
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={root} className={`panel${state?.glass ? " panel--glass" : ""}`}>
      {state && (
        <>
          <header className="panel__header">
            {settingsOpen && (
              <button
                type="button"
                className="panel__icon"
                aria-label="Back"
                title="Back"
                onClick={() => setSettingsOpen(false)}
              >
                <BackIcon />
              </button>
            )}
            <strong>{settingsOpen ? "Settings" : "Kumpan Recorder"}</strong>
            {!settingsOpen && (
              <button
                type="button"
                className="panel__icon"
                aria-label="Settings"
                title="Settings"
                onClick={() => setSettingsOpen(true)}
              >
                <GearIcon />
              </button>
            )}
            <button
              type="button"
              className="panel__icon"
              aria-label="Quit"
              title="Quit"
              onClick={() => void window.api.panel.quit()}
            >
              <PowerIcon />
            </button>
          </header>
          {settingsOpen ? (
            <Settings />
          ) : handoffOpen ? (
            <PostRecording onClose={() => setHandoffOpen(false)} />
          ) : (
            <RecordButton recorder={state.recorder} hotkey={state.hotkey} />
          )}
          <UpdateRow
            update={state.update}
            version={state.version}
            busy={state.recorder.kind !== "idle" || state.pending !== null}
          />
        </>
      )}
    </div>
  )
}

function RecordButton({
  recorder,
  hotkey,
}: {
  recorder: RecorderState
  hotkey: string
}) {
  const live = recorder.kind === "recording"
  const label = {
    idle: "Start recording",
    starting: "Starting…",
    recording: "Stop recording",
    stopping: "Stopping…",
  }[recorder.kind]
  return (
    <button
      type="button"
      className={`record${live ? " record--live" : ""}`}
      disabled={recorder.kind === "starting" || recorder.kind === "stopping"}
      onClick={() =>
        void (live
          ? window.api.panel.stopRecording()
          : window.api.panel.startRecording())
      }
    >
      <span className="record__dot" aria-hidden="true" />
      <span className="record__label">{label}</span>
      {recorder.kind === "recording" ? (
        <Elapsed since={recorder.startedAt} />
      ) : (
        hotkey && <kbd>{formatForDisplay(hotkey, isMac)}</kbd>
      )}
    </button>
  )
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const total = Math.max(0, Math.floor((now - Date.parse(since)) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = (total % 60).toString().padStart(2, "0")
  return (
    <span className="record__time">
      {h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`}
    </span>
  )
}

function UpdateRow({
  update,
  version,
  busy,
}: {
  update: UpdateState
  version: string
  busy: boolean
}) {
  const check = () => void window.api.panel.checkForUpdates()
  switch (update.kind) {
    case "ready":
      return (
        <footer className="panel__footer panel__footer--ready">
          <span>Version {update.version} is ready</span>
          <button
            type="button"
            className="link"
            disabled={busy}
            title={busy ? "Finish the current recording first" : undefined}
            onClick={() => void window.api.panel.installUpdate()}
          >
            Restart
          </button>
        </footer>
      )
    case "downloading":
      return (
        <footer className="panel__footer">
          <span>Downloading {update.version}…</span>
        </footer>
      )
    case "checking":
      return (
        <footer className="panel__footer">
          <span>Checking for updates…</span>
        </footer>
      )
    case "error":
      return (
        <footer className="panel__footer">
          <span className="status--error" title={update.message}>
            Update check failed
          </span>
          <button type="button" className="link" onClick={check}>
            Retry
          </button>
        </footer>
      )
    case "latest":
    case "idle":
      return (
        <footer className="panel__footer">
          <span>
            v{version}
            {update.kind === "latest" && " · up to date"}
          </span>
          <button type="button" className="link" onClick={check}>
            Check for updates
          </button>
        </footer>
      )
  }
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  )
}
