import { Settings } from "@/renderer/components/Settings"
import { Recorder } from "@/renderer/recorder/Recorder"
import { PostRecording } from "@/renderer/post-recording/PostRecording"
import { MeetingBanner } from "@/renderer/meeting-banner/MeetingBanner"

type View = "settings" | "recorder" | "post-recording" | "meeting-banner"

function currentView(): View {
  const params = new URLSearchParams(window.location.search)
  const v = params.get("view")
  if (v === "recorder") return "recorder"
  if (v === "post-recording") return "post-recording"
  if (v === "meeting-banner") return "meeting-banner"
  return "settings"
}

export function App() {
  const view = currentView()
  if (view === "recorder") return <Recorder />
  if (view === "post-recording") return <PostRecording />
  if (view === "meeting-banner") return <MeetingBanner />
  return (
    <main className="app">
      <Settings />
    </main>
  )
}
