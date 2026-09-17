import { useEffect, useState } from "react"
import type { MeetingBannerContext } from "@/shared/types"

type Copy = {
  heading: string
  detail: string
  primary: string
  busy: string
  secondary: string
}

function copyFor(context: MeetingBannerContext | null): Copy {
  if (context === null) {
    return {
      heading: "Meeting detected",
      detail: "",
      primary: "Record",
      busy: "Starting…",
      secondary: "Not now",
    }
  }
  if (context.kind === "start") {
    return {
      heading: `${context.source} call detected`,
      detail: context.title,
      primary: "Record",
      busy: "Starting…",
      secondary: "Not now",
    }
  }
  return {
    heading: "Still recording",
    detail:
      context.reason === "meeting-ended"
        ? `The ${context.source} call ended — stop and save?`
        : `No one has spoken for ${context.quietMinutes} minutes — stop and save?`,
    primary: "Stop",
    busy: "Stopping…",
    secondary: "Keep recording",
  }
}

export function MeetingBanner() {
  const [context, setContext] = useState<MeetingBannerContext | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.meeting.getContext().then((next) => {
      if (!cancelled) setContext(next)
    })
    // The window outlives a single prompt: a start banner is swapped for a stop banner
    // in place, so the context has to arrive by push as well as on mount.
    const off = window.api.meeting.onContext((next) => {
      setContext(next)
      setBusy(false)
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const copy = copyFor(context)
  const recording = context?.kind === "stop"

  const onPrimary = () => {
    setBusy(true)
    void window.api.meeting.accept()
  }

  return (
    <div className="banner">
      <span
        className={`banner__dot${recording ? " banner__dot--live" : ""}`}
        aria-hidden="true"
      />
      <div className="banner__text">
        <strong>{copy.heading}</strong>
        <span title={copy.detail}>{copy.detail}</span>
      </div>
      <div className="banner__actions">
        <button
          type="button"
          className="primary"
          onClick={onPrimary}
          disabled={busy}
        >
          {busy ? copy.busy : copy.primary}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => void window.api.meeting.dismiss()}
        >
          {copy.secondary}
        </button>
      </div>
    </div>
  )
}
