import { useEffect, useState } from "react"
import { HotkeyField } from "@/renderer/components/HotkeyField"

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "testing" }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string }

export function Settings() {
  const [baseUrl, setBaseUrl] = useState("")
  const [token, setToken] = useState("")
  const [hasSavedToken, setHasSavedToken] = useState(false)
  const [hotkey, setHotkey] = useState("")
  const [hotkeyDefault, setHotkeyDefault] = useState("")
  const [meetingNudge, setMeetingNudge] = useState(true)
  const [stopReminder, setStopReminder] = useState(true)
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  useEffect(() => {
    let cancelled = false
    window.api.getSettings().then((s) => {
      if (cancelled) return
      setBaseUrl(s.baseUrl)
      setHasSavedToken(s.hasToken)
      setHotkey(s.hotkey)
      setHotkeyDefault(s.hotkeyDefault)
      setMeetingNudge(s.meetingNudge)
      setStopReminder(s.stopReminder)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const onHotkeyChange = async (next: string) => {
    const updated = await window.api.setSettings({ hotkey: next })
    setHotkey(updated.hotkey)
  }

  const onMeetingNudgeChange = async (next: boolean) => {
    setMeetingNudge(next)
    const updated = await window.api.setSettings({ meetingNudge: next })
    setMeetingNudge(updated.meetingNudge)
  }

  const onStopReminderChange = async (next: boolean) => {
    setStopReminder(next)
    const updated = await window.api.setSettings({ stopReminder: next })
    setStopReminder(updated.stopReminder)
  }

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus({ kind: "saving" })
    try {
      const next = await window.api.setSettings({
        baseUrl,
        token: token.length > 0 ? token : undefined,
      })
      setHasSavedToken(next.hasToken)
      setToken("")
      setStatus({ kind: "saved" })
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      })
    }
  }

  const onClearToken = async () => {
    setStatus({ kind: "saving" })
    try {
      const next = await window.api.setSettings({ token: null })
      setHasSavedToken(next.hasToken)
      setStatus({ kind: "saved" })
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to clear token.",
      })
    }
  }

  const onTest = async () => {
    setStatus({ kind: "testing" })
    const result = await window.api.testToken()
    if (result.ok) {
      setStatus({ kind: "ok", message: "Token looks valid." })
    } else {
      setStatus({ kind: "error", message: result.message })
    }
  }

  return (
    <form className="settings" onSubmit={onSave}>
      <div className="field">
        <span>Start/stop hotkey</span>
        <HotkeyField
          value={hotkey}
          defaultValue={hotkeyDefault}
          onChange={onHotkeyChange}
        />
      </div>

      <label className="toggle">
        <input
          type="checkbox"
          checked={meetingNudge}
          onChange={(e) => void onMeetingNudgeChange(e.target.checked)}
        />
        <span>Offer to record when a call is detected</span>
      </label>

      <label className="toggle">
        <input
          type="checkbox"
          checked={stopReminder}
          onChange={(e) => void onStopReminderChange(e.target.checked)}
        />
        <span>Remind me to stop when the call ends or goes quiet</span>
      </label>

      <label className="field">
        <span>Intra base URL</span>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://intra.kumpan.se"
          required
        />
      </label>

      <label className="field">
        <span>Intra API token</span>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={hasSavedToken ? "•••••••• (saved)" : "Paste your token"}
          autoComplete="off"
        />
        {hasSavedToken && (
          <button type="button" className="link" onClick={onClearToken}>
            Clear saved token
          </button>
        )}
      </label>

      <div className="actions">
        <button type="submit">Save</button>
        <button
          type="button"
          onClick={onTest}
          disabled={!hasSavedToken && token.length === 0}
        >
          Test connection
        </button>
      </div>

      <StatusLine status={status} />

      <TroubleshootingSection />
    </form>
  )
}

function TroubleshootingSection() {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)
  if (!isMac) return null
  return (
    <section className="troubleshoot">
      <h2>Recording not working?</h2>
      <p>
        If macOS keeps refusing to record even though Screen Recording is on —
        most often after upgrading from an old unsigned version — click the
        button below to clear the stale permission entry, then reopen the app
        and grant fresh permission when macOS asks.
      </p>
      <button
        type="button"
        className="danger"
        onClick={() => {
          void window.api.resetScreenRecording()
        }}
      >
        Reset Screen Recording permission…
      </button>
    </section>
  )
}

function StatusLine({ status }: { status: Status }) {
  switch (status.kind) {
    case "idle":
      return null
    case "saving":
      return <p className="status">Saving…</p>
    case "saved":
      return <p className="status status--ok">Saved.</p>
    case "testing":
      return <p className="status">Testing…</p>
    case "ok":
      return <p className="status status--ok">{status.message}</p>
    case "error":
      return <p className="status status--error">{status.message}</p>
  }
}
