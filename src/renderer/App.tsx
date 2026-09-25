import { Settings } from "@/renderer/components/Settings"
import { Recorder } from "@/renderer/recorder/Recorder"
import { Panel } from "@/renderer/panel/Panel"
import { MeetingBanner } from "@/renderer/meeting-banner/MeetingBanner"

type View = "settings" | "recorder" | "panel" | "meeting-banner"

function currentView(): View {
  const params = new URLSearchParams(window.location.search)
  const v = params.get("view")
  if (v === "recorder") return "recorder"
  if (v === "panel") return "panel"
  if (v === "meeting-banner") return "meeting-banner"
  return "settings"
}

export function App() {
  const view = currentView()
  if (view === "recorder") return <Recorder />
  if (view === "panel") return <Panel />
  if (view === "meeting-banner") return <MeetingBanner />
  return (
    <main className="app">
      <Settings />
    </main>
  )
}
