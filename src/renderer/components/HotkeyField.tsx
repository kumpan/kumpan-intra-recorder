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
  const normalized =
    KEY_RENAME[key] ?? (key.length === 1 ? key.toUpperCase() : key)
  parts.push(normalized)
  if (parts.length < 2) return null
  return parts.join("+")
}

export function formatForDisplay(accelerator: string, mac: boolean): string {
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

// Click, press the combination, done — the way macOS shortcut recorders work. Delete
// while recording clears it, Esc or a click elsewhere backs out.
export function HotkeyField({ value, defaultValue, onChange }: Props) {
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform)

  const commit = async (next: string) => {
    setCapturing(false)
    setError(null)
    try {
      await onChange(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set shortcut.")
    }
  }

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      if (e.key === "Escape") return setCapturing(false)
      if (e.key === "Backspace" || e.key === "Delete") return void commit("")
      const acc = eventToAccelerator(e)
      if (acc) void commit(acc)
    }
    const onClick = (e: MouseEvent) => {
      if (!buttonRef.current?.contains(e.target as Node)) setCapturing(false)
    }
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("mousedown", onClick, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("mousedown", onClick, true)
    }
  }, [capturing])

  return (
    <>
      <div className="row">
        <span className="row__label">Start/stop shortcut</span>
        {!capturing && value !== defaultValue && (
          <button
            type="button"
            className="btn"
            onClick={() => void commit(defaultValue)}
          >
            Reset
          </button>
        )}
        <button
          ref={buttonRef}
          type="button"
          className={`btn hotkey${capturing ? " hotkey--capturing" : ""}`}
          onClick={() => {
            setError(null)
            setCapturing(true)
          }}
        >
          {capturing ? "Type shortcut…" : formatForDisplay(value, isMac)}
        </button>
      </div>
      {error && (
        <div className="row">
          <span className="row__value row__value--error">{error}</span>
        </div>
      )}
    </>
  )
}
