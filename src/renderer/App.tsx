import { Settings } from "@/renderer/components/Settings"
import { Recorder } from "@/renderer/recorder/Recorder"
import { PostRecording } from "@/renderer/post-recording/PostRecording"

type View = "settings" | "recorder" | "post-recording"

function currentView(): View {
  const params = new URLSearchParams(window.location.search)
  const v = params.get("view")
  if (v === "recorder") return "recorder"
  if (v === "post-recording") return "post-recording"
  return "settings"
}

export function App() {
  const view = currentView()
  if (view === "recorder") return <Recorder />
  if (view === "post-recording") return <PostRecording />
  return (
    <main className="app">
      <Settings />
    </main>
  )
}
