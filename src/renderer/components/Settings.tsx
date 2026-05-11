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
  const [status, setStatus] = useState<Status>({ kind: "idle" })

  useEffect(() => {
    let cancelled = false
    window.api.getSettings().then((s) => {
      if (cancelled) return
      setBaseUrl(s.baseUrl)
      setHasSavedToken(s.hasToken)
      setHotkey(s.hotkey)
      setHotkeyDefault(s.hotkeyDefault)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const onHotkeyChange = async (next: string) => {
    const updated = await window.api.setSettings({ hotkey: next })
    setHotkey(updated.hotkey)
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
      <h1>Settings</h1>

      <div className="field">
        <span>Start/stop hotkey</span>
        <HotkeyField
          value={hotkey}
          defaultValue={hotkeyDefault}
          onChange={onHotkeyChange}
        />
      </div>

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
        <button type="button" onClick={onTest} disabled={!hasSavedToken && token.length === 0}>
          Test connection
        </button>
      </div>

      <StatusLine status={status} />
    </form>
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
