import { useEffect, useRef, useState } from "react"

type Props = {
  value: string
  defaultValue: string
  onChange: (next: string) => Promise<void> | void
}

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "Command"])

const KEY_RENAME: Record<string, string> = {
  " ": "Space",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Escape: "Esc",
  Enter: "Return",
}

function eventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = []
  if (e.ctrlKey) parts.push("Control")
  if (e.altKey) parts.push("Alt")
  if (e.shiftKey) parts.push("Shift")
  if (e.metaKey) parts.push("Command")
  const key = e.key
  if (!key || MODIFIER_KEYS.has(key)) return null
  const normalized = KEY_RENAME[key] ?? (key.length === 1 ? key.toUpperCase() : key)
  parts.push(normalized)
  if (parts.length < 2) return null
  return parts.join("+")
}

function formatForDisplay(accelerator: string, mac: boolean): string {
  if (!accelerator) return "Disabled"
  return accelerator
    .split("+")
    .map((part) => {
      if (!mac) return part
      switch (part) {
        case "Control":
          return "⌃"
        case "Alt":
        case "Option":
          return "⌥"
        case "Shift":
          return "⇧"
        case "Command":
        case "Meta":
        case "CommandOrControl":
          return "⌘"
        default:
          return part
      }
    })
    .join(mac ? "" : "+")
}

export function HotkeyField({ value, defaultValue, onChange }: Props) {
  const [capturing, setCapturing] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.key === "Escape") {
        setCapturing(false)
        setDraft(null)
        return
      }
      const acc = eventToAccelerator(e)
      if (acc) setDraft(acc)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [capturing])

  useEffect(() => {
    if (!capturing) return
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setCapturing(false)
        setDraft(null)
      }
    }
    window.addEventListener("mousedown", onClick, true)
    return () => window.removeEventListener("mousedown", onClick, true)
  }, [capturing])

  const commit = async (next: string) => {
    setError(null)
    try {
      await onChange(next)
      setDraft(null)
      setCapturing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set hotkey.")
    }
  }

  const display = capturing
    ? draft
      ? `Captured: ${formatForDisplay(draft, isMac)}`
      : "Press a key combination…"
    : formatForDisplay(value, isMac)

  return (
    <div className="hotkey" ref={containerRef}>
      <button
        type="button"
        className={`hotkey__display${capturing ? " hotkey__display--capturing" : ""}`}
        onClick={() => {
          if (!capturing) {
            setCapturing(true)
            setDraft(null)
            setError(null)
          }
        }}
      >
        {display}
      </button>
      <div className="hotkey__actions">
        {capturing && draft && (
          <button type="button" className="primary" onClick={() => commit(draft)}>
            Save
          </button>
        )}
        {capturing && (
          <button
            type="button"
            onClick={() => {
              setCapturing(false)
              setDraft(null)
            }}
          >
            Cancel
          </button>
        )}
        {!capturing && value !== defaultValue && (
          <button type="button" onClick={() => commit(defaultValue)}>
            Reset
          </button>
        )}
        {!capturing && value !== "" && (
          <button type="button" onClick={() => commit("")}>
            Disable
          </button>
        )}
      </div>
      {error && <p className="status status--error">{error}</p>}
    </div>
  )
}
