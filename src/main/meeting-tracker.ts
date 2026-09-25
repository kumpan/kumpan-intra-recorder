import type { MeetingHit } from "@/main/meeting-match"

export type MeetingTracker = {
  // Folds this poll's matches into the tracked set and returns the calls considered
  // live — including ones this poll happened to miss but which are inside the grace
  // window.
  update: (hits: readonly MeetingHit[], now: number) => MeetingHit[]
  // The next live call that has never had a banner, marked as nudged on the way out.
  takeNudge: (now: number) => MeetingHit | null
  // Calls live while a recording runs are being recorded; they have had their chance.
  markLiveNudged: () => void
  has: (key: string) => boolean
  live: () => MeetingHit[]
  clear: () => void
}

type TrackedMeeting = {
  hit: MeetingHit
  firstSeenMs: number
  lastSeenMs: number
  nudged: boolean
}

// Window enumeration is a lossy view of what is going on: a browser window is titled
// after its active tab, so a call disappears the moment the user switches tab, and a
// minimised window or one on another Space can drop out of a poll for no reason at
// all. Keeping a call in the set across those gaps — and remembering it was already
// nudged — is what stops the banner firing again every time focus moves.
export function createMeetingTracker(options: {
  // Absent this long, a call no longer counts as live.
  goneAfterMs: number
  // A nudged call is remembered this long after it was last seen, so tabbing away from
  // a call for a while and back doesn't read as a new one. A mic hit is never
  // remembered past goneAfterMs: its key is the app, not the call.
  rememberNudgedMs: number
  // A mic-only hit waits this long before it earns a banner; dictation and voice
  // notes hold the mic for seconds, calls for minutes.
  micSettleMs: number
}): MeetingTracker {
  const meetings = new Map<string, TrackedMeeting>()
  let now = 0

  const isLive = (tracked: TrackedMeeting): boolean =>
    now - tracked.lastSeenMs <= options.goneAfterMs

  const tracked = (): TrackedMeeting[] => [...meetings.values()].filter(isLive)

  const live = (): MeetingHit[] => tracked().map((t) => t.hit)

  return {
    update(hits, at) {
      now = at
      for (const hit of hits) {
        const existing = meetings.get(hit.key)
        if (existing) {
          existing.hit = hit
          existing.lastSeenMs = now
        } else {
          meetings.set(hit.key, {
            hit,
            firstSeenMs: now,
            lastSeenMs: now,
            nudged: false,
          })
        }
      }
      // The mic in use while a titled call is on screen is that call. Marking it here,
      // not just skipping it, keeps it quiet after the user tabs away from the title.
      const current = tracked()
      if (current.some((t) => !t.hit.viaMic)) {
        for (const t of current) if (t.hit.viaMic) t.nudged = true
      }
      for (const [key, t] of meetings) {
        const age = now - t.lastSeenMs
        if (age <= options.goneAfterMs) continue
        if (t.hit.viaMic || !t.nudged || age > options.rememberNudgedMs)
          meetings.delete(key)
      }
      return live()
    },

    takeNudge(at) {
      const next = tracked().find(
        (t) =>
          !t.nudged &&
          (!t.hit.viaMic || at - t.firstSeenMs >= options.micSettleMs)
      )
      if (!next) return null
      next.nudged = true
      return next.hit
    },

    markLiveNudged() {
      for (const t of tracked()) t.nudged = true
    },

    has: (key) => live().some((hit) => hit.key === key),
    live,
    clear: () => meetings.clear(),
  }
}
