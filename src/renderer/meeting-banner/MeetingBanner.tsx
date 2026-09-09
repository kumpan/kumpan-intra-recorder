import { useEffect, useState } from "react"
import type { MeetingBannerContext } from "@/shared/types"

export function MeetingBanner() {
  const [context, setContext] = useState<MeetingBannerContext | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.meeting.getContext().then((next) => {
      if (!cancelled) setContext(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const onRecord = () => {
    setStarting(true)
    void window.api.meeting.accept()
  }

  return (
    <div className="banner">
      <span className="banner__dot" aria-hidden="true" />
      <div className="banner__text">
        <strong>
          {context ? `${context.source} call detected` : "Meeting detected"}
        </strong>
        <span title={context?.title ?? ""}>{context?.title ?? ""}</span>
      </div>
      <div className="banner__actions">
        <button
          type="button"
          className="primary"
          onClick={onRecord}
          disabled={starting}
        >
          {starting ? "Starting…" : "Record"}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => void window.api.meeting.dismiss()}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
