// Declared here so this module imports nothing: meeting-match.check.ts runs it under
// bare `node`, which cannot resolve the "@/" path alias.
export type MeetingHit = {
  source: string
  title: string
  // Stable across the churn a live call puts a window title through, so the watcher can
  // tell "same call, retitled" from "a new call started".
  key: string
}

const MEET_CODE = /\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/

// Chrome on macOS titles its window after the active tab alone — no " - Google Chrome"
// suffix — so the Meet pattern has to anchor on the tab title itself. Meet separates
// "Meet" from the meeting code with an en dash, but a plain hyphen turns up in some
// locales, and "Google Meet" (the landing page, no code) must not match.
const PATTERNS: ReadonlyArray<{
  source: string
  re: RegExp
  keyOf: (title: string) => string
}> = [
  {
    source: "Google Meet",
    re: /^Meet\s[–—-]\s/,
    keyOf: (title) =>
      `meet:${MEET_CODE.exec(title)?.[1] ?? title.toLowerCase()}`,
  },
  {
    source: "Zoom",
    re: /^Zoom Meeting\b/,
    // Zoom puts no identifier in the title, so every in-call window collapses onto one
    // key. Two simultaneous Zoom calls would read as one; nobody does that.
    keyOf: () => "zoom:meeting",
  },
]

// ponytail: Teams is deliberately absent — its in-meeting window and its main window
// are both titled "<something> | Microsoft Teams", so no title tells them apart. Add a
// pattern here once someone reads a real title off a live Teams call.

const UNREAD_BADGE = /^\(\d+\)\s*/
const BROWSER_SUFFIX =
  /\s[-–—]\s(Google Chrome|Chromium|Microsoft Edge|Brave|Arc|Mozilla Firefox|Firefox|Safari|Opera|Vivaldi)$/

// The same call yields a different raw title minute to minute: a chat message adds an
// "(3)" badge, some browsers append their own name, Meet swaps the dash. Fold all of
// that away before matching so one call keeps one identity.
function normalize(title: string): string {
  return title
    .replace(UNREAD_BADGE, "")
    .replace(BROWSER_SUFFIX, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function matchMeetings(titles: readonly string[]): MeetingHit[] {
  const hits: MeetingHit[] = []
  const seen = new Set<string>()
  for (const raw of titles) {
    const title = normalize(raw)
    for (const pattern of PATTERNS) {
      if (!pattern.re.test(title)) continue
      const key = pattern.keyOf(title)
      if (!seen.has(key)) {
        seen.add(key)
        hits.push({ source: pattern.source, title, key })
      }
      break
    }
  }
  return hits
}

export function matchMeeting(titles: readonly string[]): MeetingHit | null {
  return matchMeetings(titles)[0] ?? null
}
