import { desktopCapturer, systemPreferences } from "electron"
import { matchMeeting, type MeetingHit } from "@/main/meeting-match"
import { closeMeetingBanner, openMeetingBanner } from "@/main/windows"
import { getRecorderState, onRecorderState } from "@/main/recorder-session"
import { getMeetingNudge } from "@/main/settings-store"
import { startRecordingFromTray } from "@/main/recorder-controller"

const POLL_MS = 12_000

let timer: ReturnType<typeof setInterval> | null = null
let showing: MeetingHit | null = null
const dismissed = new Set<string>()

// Enumerating windows needs the same Screen Recording grant as capturing them, so
// polling before the user has granted it would fire the OS prompt out of nowhere —
// long before they ever press Record. Stay quiet until the grant already exists.
function canReadWindowTitles(): boolean {
  if (process.platform !== "darwin") return true
  return systemPreferences.getMediaAccessStatus("screen") === "granted"
}

async function windowTitles(): Promise<string[]> {
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 0, height: 0 },
    fetchWindowIcons: false,
  })
  return sources.map((source) => source.name)
}

async function tick(): Promise<void> {
  if (
    !getMeetingNudge() ||
    getRecorderState().kind !== "idle" ||
    !canReadWindowTitles()
  ) {
    hide()
    return
  }

  let titles: string[]
  try {
    titles = await windowTitles()
  } catch (err) {
    console.error("[meeting-watcher] could not read window titles", err)
    return
  }

  // A dismissal lasts only as long as that meeting's window does, so the next call
  // nudges again instead of inheriting the last one's "not now".
  for (const title of dismissed) {
    if (!titles.includes(title)) dismissed.delete(title)
  }

  const hit = matchMeeting(titles)
  if (!hit || dismissed.has(hit.title)) {
    hide()
    return
  }
  if (showing?.title === hit.title) return

  hide()
  showing = hit
  openMeetingBanner()
}

function hide(): void {
  if (!showing) return
  showing = null
  closeMeetingBanner()
}

export function startMeetingWatcher(): void {
  if (timer) return
  timer = setInterval(() => void tick(), POLL_MS)
  onRecorderState(() => {
    if (getRecorderState().kind !== "idle") hide()
  })
  void tick()
}

export function stopMeetingWatcher(): void {
  if (timer) clearInterval(timer)
  timer = null
  hide()
}

export function getMeetingBannerContext(): MeetingHit | null {
  return showing
}

export function dismissMeetingBanner(): void {
  if (showing) dismissed.add(showing.title)
  hide()
}

export async function acceptMeetingBanner(): Promise<void> {
  if (showing) dismissed.add(showing.title)
  hide()
  await startRecordingFromTray()
}
