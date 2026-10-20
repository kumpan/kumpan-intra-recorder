import { useEffect, useRef, useState } from "react"
import type { PanelState, RecorderState, UpdateState } from "@/shared/types"
import { PostRecording } from "@/renderer/post-recording/PostRecording"
import { Settings } from "@/renderer/components/Settings"
import { formatForDisplay } from "@/renderer/components/HotkeyField"
import { BackIcon, GearIcon, PowerIcon } from "@/renderer/components/icons"

const isMac = /Mac/.test(navigator.platform)

export function Panel() {
  const [state, setState] = useState<PanelState | null>(null)
  const [handoffId, setHandoffId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.api.panel.getState().then(setState)
    return window.api.panel.onState(setState)
  }, [])

  // The handoff opens on a finished recording and stays after Upload / Save clears it
  // in main, so the outcome ("Open in intra") is still there until the user closes it.
  // A new recording (hotkey, banner) drops it: the last outcome must never stand in
  // for a recording in progress or the one after it.
  const pendingId = state?.pending?.sessionId ?? null
  const recorderKind = state?.recorder.kind
  useEffect(() => {
    if (recorderKind !== "idle") setHandoffId(null)
    else if (pendingId && !handoffId) setHandoffId(pendingId)
  }, [recorderKind, pendingId, handoffId])

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

  const busy = state
    ? state.recorder.kind !== "idle" || state.pending !== null
    : false

  return (
    <div ref={root} className={`panel${state?.glass ? " panel--glass" : ""}`}>
      {state && (
        <>
          {settingsOpen ? (
            <header className="panel__header panel__header--sub">
              <button
                type="button"
                className="icon-btn"
                aria-label="Back"
                title="Back"
                onClick={() => setSettingsOpen(false)}
              >
                <BackIcon size={18} />
              </button>
              <h1>Settings</h1>
            </header>
          ) : (
            <header className="panel__header">
              <h1>Kumpan Recorder</h1>
              <div className="icon-pill">
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Settings"
                  title="Settings"
                  onClick={() => setSettingsOpen(true)}
                >
                  <GearIcon />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Quit"
                  title="Quit Kumpan Recorder"
                  onClick={() => void window.api.panel.quit()}
                >
                  <PowerIcon />
                </button>
              </div>
            </header>
          )}
          {settingsOpen ? (
            <div className="panel__body panel__body--scroll">
              <Settings version={state.version} update={state.update} />
            </div>
          ) : (
            <div className="panel__body">
              {handoffId ? (
                <PostRecording
                  key={handoffId}
                  onClose={() => setHandoffId(null)}
                />
              ) : (
                <RecordButton recorder={state.recorder} />
              )}
            </div>
          )}
          <Footer
            update={state.update}
            version={state.version}
            hotkey={state.hotkey}
            busy={busy}
          />
        </>
      )}
    </div>
  )
}

function RecordButton({ recorder }: { recorder: RecorderState }) {
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
      <span className="record__icon" aria-hidden="true" />
      <span className="record__label">
        <strong>{label}</strong>
        <small>
          {live
            ? "Call audio and your mic"
            : "Call audio and your mic, kept local"}
        </small>
      </span>
      {recorder.kind === "recording" && <Elapsed since={recorder.startedAt} />}
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

function Footer({
  update,
  version,
  hotkey,
  busy,
}: {
  update: UpdateState
  version: string
  hotkey: string
  busy: boolean
}) {
  const shortcut = hotkey && (
    <kbd title="Start/stop shortcut">{formatForDisplay(hotkey, isMac)}</kbd>
  )
  switch (update.kind) {
    case "ready":
      return (
        <footer className="panel__footer panel__footer--ready">
          <span>Version {update.version} is ready</span>
          <button
            type="button"
            className="btn btn--link"
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
          {shortcut}
        </footer>
      )
    default:
      return (
        <footer className="panel__footer">
          <span>Version {version}</span>
          {shortcut}
        </footer>
      )
  }
}
