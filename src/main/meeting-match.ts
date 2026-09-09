// Structurally the same as MeetingBannerContext in @/shared/types, but declared here so
// this module imports nothing: meeting-match.check.ts runs it under bare `node`, which
// cannot resolve the "@/" path alias.
export type MeetingHit = {
  source: string
  title: string
}

// Chrome on macOS titles its window after the active tab alone — no " - Google Chrome"
// suffix — so the Meet pattern has to anchor on the tab title itself. Meet separates
// "Meet" from the meeting code with an en dash, but a plain hyphen turns up in some
// locales, and "Google Meet" (the landing page, no code) must not match.
const PATTERNS: ReadonlyArray<{ source: string; re: RegExp }> = [
  { source: "Google Meet", re: /^Meet\s[–—-]\s/ },
  { source: "Zoom", re: /^Zoom Meeting\b/ },
]

// ponytail: Teams is deliberately absent — its in-meeting window and its main window
// are both titled "<something> | Microsoft Teams", so no title tells them apart. Add a
// pattern here once someone reads a real title off a live Teams call.

export function matchMeeting(titles: readonly string[]): MeetingHit | null {
  for (const title of titles) {
    for (const pattern of PATTERNS) {
      if (pattern.re.test(title)) return { source: pattern.source, title }
    }
  }
  return null
}
