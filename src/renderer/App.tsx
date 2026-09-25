import { Recorder } from "@/renderer/recorder/Recorder"
import { Panel } from "@/renderer/panel/Panel"
import { MeetingBanner } from "@/renderer/meeting-banner/MeetingBanner"

export function App() {
  const view = new URLSearchParams(window.location.search).get("view")
  if (view === "recorder") return <Recorder />
  if (view === "meeting-banner") return <MeetingBanner />
  return <Panel />
}
