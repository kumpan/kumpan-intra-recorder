import { getBannerContext, hideBanner, showBanner } from "@/main/banner"
import type { MeetingHit } from "@/main/meeting-match"
import { getLiveMeetings, onMeetingSnapshot } from "@/main/meeting-watcher"
import { stopRecordingFromTray } from "@/main/recorder-controller"
import { getRecorderState, onRecorderState } from "@/main/recorder-session"
import { getStopReminder } from "@/main/settings-store"
import type { MeetingBannerContext } from "@/shared/types"

const EVALUATE_MS = 15_000

// Long enough that a demo, a shared video, or someone reading a document in silence
// does not trigger it; short enough that a forgotten recording is caught while the
// user is still at their desk.
const SILENT_PROMPT_MS = 5 * 60_000

// "Keep recording" — and an ignored prompt — buys this much quiet before the next one.
const SNOOZE_MS = 10 * 60_000

const PROMPT_VISIBLE_MS = 60_000

let timer: ReturnType<typeof setInterval> | null = null
let promptTimer: ReturnType<typeof setTimeout> | null = null
let unsubscribe: Array<() => void> = []

// Every call seen while this recording has been running. The user often starts the
// recorder before joining, so the set keeps growing until the recording ends.
let watched = new Set<string>()
let watchedSource: string | null = null
let meetingEnded = false
let silentSince: number | null = null
let snoozedUntil = 0
let prompting = false

export function startStopReminder(): void {
  if (timer) return
  timer = setInterval(() => evaluate(), EVALUATE_MS)
  unsubscribe = [
    onMeetingSnapshot(handleSnapshot),
    onRecorderState(() => handleRecorderState()),
  ]
}

export function stopStopReminder(): void {
  if (timer) clearInterval(timer)
  timer = null
  for (const off of unsubscribe) off()
  unsubscribe = []
  reset()
}

// The renderer is the only side that can see the audio, so it reports whether the mix
// has gone quiet; how long that has to last before it means anything is decided here.
export function reportAudioActivity(silent: boolean): void {
  if (getRecorderState().kind !== "recording") return
  if (!silent) {
    silentSince = null
    return
  }
  if (silentSince === null) silentSince = Date.now()
}

function handleRecorderState(): void {
  if (getRecorderState().kind === "recording") {
    reset()
    for (const hit of getLiveMeetings()) {
      watched.add(hit.key)
      watchedSource = hit.source
    }
    return
  }
  if (getBannerContext()?.kind === "stop") hideBanner()
  reset()
}

function handleSnapshot(live: MeetingHit[]): void {
  if (getRecorderState().kind !== "recording") return
  for (const hit of live) {
    watched.add(hit.key)
    watchedSource = hit.source
  }
  if (watched.size === 0) return
  meetingEnded = !live.some((hit) => watched.has(hit.key))
}

function evaluate(): void {
  if (prompting) return
  if (!getStopReminder() || getRecorderState().kind !== "recording") return

  const now = Date.now()
  if (now < snoozedUntil) return

  if (meetingEnded) {
    prompt(
      {
        kind: "stop",
        reason: "meeting-ended",
        source: watchedSource ?? "Meeting",
      },
      // "Keep recording" after the call itself ended is a deliberate choice — a debrief,
      // a demo recorded on purpose — so stop holding the ended call against them. Quiet
      // still nudges, which is the backstop for a genuinely forgotten recording.
      () => {
        watched = new Set<string>()
        meetingEnded = false
      }
    )
    return
  }
  if (silentSince !== null && now - silentSince >= SILENT_PROMPT_MS) {
    prompt({
      kind: "stop",
      reason: "silence",
      quietMinutes: Math.round((now - silentSince) / 60_000),
    })
  }
}

function prompt(
  context: Extract<MeetingBannerContext, { kind: "stop" }>,
  onKeepRecording?: () => void
): void {
  prompting = true
  // An ignored prompt is not an answer: it takes itself away and comes back after the
  // snooze, because the user who forgets to stop is often not at the screen.
  promptTimer = setTimeout(() => snooze(), PROMPT_VISIBLE_MS)
  showBanner(context, {
    onAccept: () => {
      clearPrompt()
      stopRecordingFromTray()
    },
    onDismiss: () => {
      onKeepRecording?.()
      snooze()
    },
  })
}

function snooze(): void {
  clearPrompt()
  snoozedUntil = Date.now() + SNOOZE_MS
  hideBanner()
}

function clearPrompt(): void {
  if (promptTimer) clearTimeout(promptTimer)
  promptTimer = null
  prompting = false
}

function reset(): void {
  clearPrompt()
  watched = new Set<string>()
  watchedSource = null
  meetingEnded = false
  silentSince = null
  snoozedUntil = 0
}
