import { desktopCapturer, systemPreferences } from "electron"
import { matchMeetings, type MeetingHit } from "@/main/meeting-match"
import { createMeetingTracker } from "@/main/meeting-tracker"
import { hideBanner, showBanner } from "@/main/banner"
import { getRecorderState, onRecorderState } from "@/main/recorder-session"
import { getMeetingNudge, getStopReminder } from "@/main/settings-store"
import { startRecordingFromTray } from "@/main/recorder-controller"

const POLL_MS = 12_000

// Only an absence this long counts as the call being over; anything shorter is the
// window title churning mid-meeting. It also sets how soon after a call really ends
// the stop reminder can fire.
const GONE_AFTER_MS = 90_000

// The banner floats over the call, so it takes itself away. One nudge per call: a
// meeting that has had its banner never gets another, however its title churns.
const NUDGE_VISIBLE_MS = 45_000

type SnapshotListener = (live: MeetingHit[]) => void

const tracker = createMeetingTracker({ goneAfterMs: GONE_AFTER_MS })
let snapshotListeners: SnapshotListener[] = []
let timer: ReturnType<typeof setInterval> | null = null
let bannerKey: string | null = null
let bannerTimer: ReturnType<typeof setTimeout> | null = null

// Enumerating windows needs the same Screen Recording grant as capturing them, so
// polling before the user has granted it would fire the OS prompt out of nowhere —
// long before they ever press Record. Stay quiet until the grant already exists.
function canReadWindowTitles(): boolean {
  if (process.platform !== "darwin") return true
  return systemPreferences.getMediaAccessStatus("screen") === "granted"
}

// Idle, the poll feeds the record nudge; recording, it is what notices the call ending.
function pollingWanted(): boolean {
  return getRecorderState().kind === "idle"
    ? getMeetingNudge()
    : getStopReminder()
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
  if (!pollingWanted() || !canReadWindowTitles()) {
    hideStartBanner()
    return
  }

  let titles: string[]
  try {
    titles = await windowTitles()
  } catch (err) {
    console.error("[meeting-watcher] could not read window titles", err)
    return
  }

  const live = tracker.update(matchMeetings(titles), Date.now())
  for (const listener of snapshotListeners) listener(live)

  if (bannerKey !== null && !tracker.has(bannerKey)) hideStartBanner()
  maybeNudge()
}

function maybeNudge(): void {
  if (bannerKey !== null) return
  if (!getMeetingNudge() || getRecorderState().kind !== "idle") return

  const next = tracker.takeNudge()
  if (!next) return

  bannerKey = next.key
  bannerTimer = setTimeout(() => hideStartBanner(), NUDGE_VISIBLE_MS)
  showBanner(
    { kind: "start", source: next.source, title: next.title },
    {
      onAccept: async () => {
        forgetBanner()
        await startRecordingFromTray()
      },
      onDismiss: forgetBanner,
    }
  )
}

function forgetBanner(): void {
  if (bannerTimer) clearTimeout(bannerTimer)
  bannerTimer = null
  bannerKey = null
}

function hideStartBanner(): void {
  if (bannerKey === null) return
  forgetBanner()
  hideBanner()
}

export function startMeetingWatcher(): void {
  if (timer) return
  timer = setInterval(() => void tick(), POLL_MS)
  onRecorderState(() => {
    if (getRecorderState().kind !== "idle") hideStartBanner()
  })
  void tick()
}

export function stopMeetingWatcher(): void {
  if (timer) clearInterval(timer)
  timer = null
  tracker.clear()
  hideStartBanner()
}

export function getLiveMeetings(): MeetingHit[] {
  return tracker.live()
}

export function onMeetingSnapshot(listener: SnapshotListener): () => void {
  snapshotListeners.push(listener)
  return () => {
    snapshotListeners = snapshotListeners.filter((l) => l !== listener)
  }
}
