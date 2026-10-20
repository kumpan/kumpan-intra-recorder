import { useEffect, useState } from "react"
import type { MeetingBannerContext } from "@/shared/types"
import {
  CloseIcon,
  RecordIcon,
  StopIcon,
  VideoIcon,
} from "@/renderer/components/icons"

type Copy = {
  eyebrow: string
  title: string
  detail: string
  primary: string
  busy: string
  // Only the stop prompt gets a labelled way out: "Keep recording" says what dismissing
  // it means, where the start prompt's × already does.
  secondary: string | null
}

function copyFor(context: MeetingBannerContext | null): Copy {
  if (context === null || context.kind === "start") {
    return {
      eyebrow: context ? `${context.source} call detected` : "Call detected",
      title: context?.title || "Meeting in progress",
      detail: "Record it to send the conversation to intra",
      primary: "Record",
      busy: "Starting…",
      secondary: null,
    }
  }
  return {
    eyebrow:
      context.reason === "meeting-ended"
        ? `Still recording · ${context.source}`
        : "Still recording",
    title:
      context.reason === "meeting-ended"
        ? "The call ended"
        : `Quiet for ${context.quietMinutes} minutes`,
    detail: "Stop to upload or save the recording",
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
  const dismiss = () => void window.api.meeting.dismiss()

  return (
    <div className="banner">
      <span
        className={`banner__icon${recording ? " banner__icon--live" : ""}`}
        aria-hidden="true"
      >
        {recording ? <StopIcon size={22} /> : <VideoIcon size={22} />}
      </span>
      <div className="banner__text">
        <small>{copy.eyebrow}</small>
        <strong title={copy.title}>{copy.title}</strong>
        <small>{copy.detail}</small>
      </div>
      <div className="banner__actions">
        {copy.secondary && (
          <button type="button" className="btn btn--large" onClick={dismiss}>
            {copy.secondary}
          </button>
        )}
        <button
          type="button"
          className={`btn btn--large btn--primary${recording ? " btn--stop" : ""}`}
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void window.api.meeting.accept()
          }}
        >
          {recording ? <StopIcon size={14} /> : <RecordIcon size={14} />}
          {busy ? copy.busy : copy.primary}
        </button>
        {!copy.secondary && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Not now"
            title="Not now"
            onClick={dismiss}
          >
            <CloseIcon size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
