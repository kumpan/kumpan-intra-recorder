import { useEffect, useState } from "react"
import type { UpdateState } from "@/shared/types"
import { HotkeyField } from "@/renderer/components/HotkeyField"

type Connection =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "ok" }
  | { kind: "error"; message: string }

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)

export function Settings({
  version,
  update,
}: {
  version: string
  update: UpdateState
}) {
  const [baseUrl, setBaseUrl] = useState("")
  const [savedBaseUrl, setSavedBaseUrl] = useState("")
  const [token, setToken] = useState("")
  const [hasToken, setHasToken] = useState(false)
  const [hotkey, setHotkey] = useState("")
  const [hotkeyDefault, setHotkeyDefault] = useState("")
  const [meetingNudge, setMeetingNudge] = useState(true)
  const [stopReminder, setStopReminder] = useState(true)
  const [connection, setConnection] = useState<Connection>({ kind: "idle" })

  const test = async () => {
    setConnection({ kind: "testing" })
    const result = await window.api.testToken()
    setConnection(
      result.ok ? { kind: "ok" } : { kind: "error", message: result.message }
    )
  }

  // Each change saves on its own, as in System Settings: there is no Save button to
  // forget. A saved token is checked straight away so a bad paste shows up here, not
  // on the first upload.
  const save = async (patch: Parameters<typeof window.api.setSettings>[0]) => {
    try {
      const next = await window.api.setSettings(patch)
      setBaseUrl(next.baseUrl)
      setSavedBaseUrl(next.baseUrl)
      setHasToken(next.hasToken)
      setMeetingNudge(next.meetingNudge)
      setStopReminder(next.stopReminder)
      if (next.hasToken && ("token" in patch || "baseUrl" in patch)) void test()
      if (!next.hasToken) setConnection({ kind: "idle" })
    } catch (err) {
      setConnection({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      })
    }
  }

  useEffect(() => {
    let cancelled = false
    window.api.getSettings().then((s) => {
      if (cancelled) return
      setBaseUrl(s.baseUrl)
      setSavedBaseUrl(s.baseUrl)
      setHasToken(s.hasToken)
      setHotkey(s.hotkey)
      setHotkeyDefault(s.hotkeyDefault)
      setMeetingNudge(s.meetingNudge)
      setStopReminder(s.stopReminder)
      if (s.hasToken) void test()
    })
    return () => {
      cancelled = true
    }
  }, [])

  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur()
  }

  return (
    <>
      <section className="section">
        <h2 className="section__title">Updates</h2>
        <div className="group">
          <div className="row">
            <span className="row__label">Version</span>
            <span
              className={`row__value${update.kind === "error" ? " row__value--error" : ""}`}
              title={update.kind === "error" ? update.message : undefined}
            >
              {updateLabel(update, version)}
            </span>
            <button
              type="button"
              className="btn"
              disabled={
                update.kind !== "idle" &&
                update.kind !== "latest" &&
                update.kind !== "error"
              }
              onClick={() => void window.api.panel.checkForUpdates()}
            >
              Check for Updates
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Recording</h2>
        <div className="group">
          <HotkeyField
            value={hotkey}
            defaultValue={hotkeyDefault}
            onChange={async (next) => {
              const updated = await window.api.setSettings({ hotkey: next })
              setHotkey(updated.hotkey)
            }}
          />
          <label className="row">
            <span className="row__label">Offer to record calls</span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={meetingNudge}
              onChange={(e) => {
                setMeetingNudge(e.target.checked)
                void save({ meetingNudge: e.target.checked })
              }}
            />
          </label>
          <label className="row">
            <span className="row__label">Remind me to stop</span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={stopReminder}
              onChange={(e) => {
                setStopReminder(e.target.checked)
                void save({ stopReminder: e.target.checked })
              }}
            />
          </label>
        </div>
        <p className="caption">
          For Google Meet and Zoom. Nothing records without a click.
        </p>
      </section>

      <section className="section">
        <h2 className="section__title">Intra</h2>
        <div className="group">
          <div className="row">
            <span className="row__label">Server</span>
            <input
              type="url"
              className="inline-input"
              value={baseUrl}
              placeholder="https://intra.kumpan.se"
              spellCheck={false}
              onChange={(e) => setBaseUrl(e.target.value)}
              onKeyDown={blurOnEnter}
              onBlur={() => {
                if (baseUrl !== savedBaseUrl) void save({ baseUrl })
              }}
            />
          </div>
          <div className="row">
            <span className="row__label">API token</span>
            {hasToken ? (
              <>
                <span className="row__value">Saved</span>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void save({ token: null })}
                >
                  Remove
                </button>
              </>
            ) : (
              <input
                type="password"
                className="inline-input"
                value={token}
                placeholder="Paste token"
                autoComplete="off"
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={blurOnEnter}
                onBlur={() => {
                  if (token.length === 0) return
                  setToken("")
                  void save({ token })
                }}
              />
            )}
          </div>
          <div className="row">
            <span className="row__label">Status</span>
            <ConnectionValue connection={connection} hasToken={hasToken} />
            <button
              type="button"
              className="btn"
              disabled={!hasToken || connection.kind === "testing"}
              onClick={() => void test()}
            >
              Test
            </button>
          </div>
        </div>
        <p className="caption">Create a token in intra's settings.</p>
      </section>

      {isMac && (
        <section className="section">
          <h2 className="section__title">Troubleshooting</h2>
          <div className="group">
            <div className="row">
              <span className="row__label">Screen Recording</span>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => void window.api.resetScreenRecording()}
              >
                Reset…
              </button>
            </div>
          </div>
          <p className="caption">
            If macOS keeps refusing to record with the permission on, reset it,
            reopen the app and allow it again.
          </p>
        </section>
      )}
    </>
  )
}

function updateLabel(update: UpdateState, version: string): string {
  switch (update.kind) {
    case "checking":
      return "Checking…"
    case "downloading":
      return `Downloading ${update.version}…`
    case "ready":
      return `${update.version} ready`
    case "error":
      return "Check failed"
    case "latest":
      return `${version} · Latest`
    case "idle":
      return version
  }
}

function ConnectionValue({
  connection,
  hasToken,
}: {
  connection: Connection
  hasToken: boolean
}) {
  if (!hasToken && connection.kind !== "error")
    return <span className="row__value">No token</span>
  switch (connection.kind) {
    case "idle":
      return <span className="row__value">Not checked</span>
    case "testing":
      return <span className="row__value">Checking…</span>
    case "ok":
      return <span className="row__value row__value--ok">● Connected</span>
    case "error":
      return (
        <span
          className="row__value row__value--error"
          title={connection.message}
        >
          {connection.message}
        </span>
      )
  }
}
