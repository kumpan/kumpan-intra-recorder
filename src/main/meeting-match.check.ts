import assert from "node:assert/strict"
import { matchMeeting } from "./meeting-match.ts"

const hit = (title: string) => matchMeeting([title])

assert.deepEqual(hit("Meet – abc-defg-hij"), {
  source: "Google Meet",
  title: "Meet – abc-defg-hij",
})
assert.equal(hit("Meet - Weekly sync")?.source, "Google Meet")
assert.equal(hit("Meet – abc-defg-hij - Google Chrome")?.source, "Google Meet")
assert.equal(hit("Zoom Meeting")?.source, "Zoom")

assert.equal(hit("Google Meet"), null, "Meet landing page is not a live call")
assert.equal(hit("Meeting notes – Google Docs"), null)
assert.equal(hit("Zoom Workplace"), null)
assert.equal(hit("Zoom Meetings"), null)
assert.equal(hit("ApartDirect.com | Kumpan Intra"), null)
assert.equal(matchMeeting([]), null)

assert.equal(
  matchMeeting(["Slack", "Zoom Meeting", "Meet – abc-defg-hij"])?.source,
  "Zoom",
  "first matching window in the list wins"
)

console.log("meeting-match: all checks passed")
