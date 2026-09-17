import { useEffect, useRef, useState } from "react"
import {
  startMixedRecording,
  type RecordingSession,
} from "@/renderer/recorder/mixer"

type Phase = "idle" | "starting" | "recording" | "stopping" | "error"

export function Recorder() {
  const sessionRef = useRef<RecordingSession | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const offStart = window.api.recorder.onCommandStart(() => {
      void begin()
    })
    const offStop = window.api.recorder.onCommandStop(() => {
      void end()
    })
    return () => {
      offStart()
      offStop()
    }
  }, [])

  async function begin(): Promise<void> {
    if (sessionRef.current) return
    setPhase("starting")
    setError(null)
    const sessionId = crypto.randomUUID()
    sessionIdRef.current = sessionId
    try {
      const startedAt = new Date().toISOString()
      await window.api.recorder.start({ sessionId, startedAt })

      const session = await startMixedRecording({
        onChunk: (data) => {
          window.api.recorder.sendChunk({ sessionId, data })
        },
        onError: (message) => {
          setError(message)
          setPhase("error")
          window.api.recorder.reportFailure({ sessionId, message })
          sessionRef.current = null
          sessionIdRef.current = null
        },
        onStopped: () => {
          sessionRef.current = null
        },
        onSilenceChange: (silent) => {
          window.api.recorder.reportAudioActivity({ silent })
        },
      })
      sessionRef.current = session
      setPhase("recording")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start recording."
      setError(message)
      setPhase("error")
      window.api.recorder.reportFailure({
        sessionId: sessionIdRef.current,
        message,
      })
      sessionIdRef.current = null
    }
  }

  async function end(): Promise<void> {
    const session = sessionRef.current
    const sessionId = sessionIdRef.current
    if (!session || !sessionId) return
    setPhase("stopping")
    try {
      await session.stop()
      const endedAt = new Date().toISOString()
      await window.api.recorder.finish({ sessionId, endedAt })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to stop cleanly."
      window.api.recorder.reportFailure({ sessionId, message })
      setError(message)
      setPhase("error")
      return
    } finally {
      sessionRef.current = null
      sessionIdRef.current = null
    }
    setPhase("idle")
  }

  return (
    <div className="recorder-host" aria-hidden>
      <span className={`indicator indicator--${phase}`} />
      {error && <span className="error">{error}</span>}
    </div>
  )
}
