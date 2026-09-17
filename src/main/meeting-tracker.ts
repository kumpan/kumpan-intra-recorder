import type { MeetingHit } from "@/main/meeting-match"

export type MeetingTracker = {
  // Folds this poll's matches into the tracked set and returns the calls considered
  // live — including ones this poll happened to miss but which are inside the grace
  // window.
  update: (hits: readonly MeetingHit[], now: number) => MeetingHit[]
  // The next call that has never had a banner, marked as nudged on the way out.
  takeNudge: () => MeetingHit | null
  has: (key: string) => boolean
  live: () => MeetingHit[]
  clear: () => void
}

type TrackedMeeting = {
  hit: MeetingHit
  lastSeenMs: number
  nudged: boolean
}

// Window enumeration is a lossy view of what is going on: a browser window is titled
// after its active tab, so a call disappears the moment the user switches tab, and a
// minimised window or one on another Space can drop out of a poll for no reason at
// all. Keeping a call in the set across those gaps — and remembering it was already
// nudged — is what stops the banner firing again every time focus moves.
export function createMeetingTracker(options: {
  goneAfterMs: number
}): MeetingTracker {
  const meetings = new Map<string, TrackedMeeting>()

  const live = (): MeetingHit[] =>
    [...meetings.values()].map((tracked) => tracked.hit)

  return {
    update(hits, now) {
      for (const hit of hits) {
        const tracked = meetings.get(hit.key)
        if (tracked) {
          tracked.hit = hit
          tracked.lastSeenMs = now
        } else {
          meetings.set(hit.key, { hit, lastSeenMs: now, nudged: false })
        }
      }
      for (const [key, tracked] of meetings) {
        if (now - tracked.lastSeenMs > options.goneAfterMs) meetings.delete(key)
      }
      return live()
    },

    takeNudge() {
      const next = [...meetings.values()].find((tracked) => !tracked.nudged)
      if (!next) return null
      next.nudged = true
      return next.hit
    },

    has: (key) => meetings.has(key),
    live,
    clear: () => meetings.clear(),
  }
}
