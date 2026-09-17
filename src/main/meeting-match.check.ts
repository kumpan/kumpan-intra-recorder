import assert from "node:assert/strict"
import { matchMeeting, matchMeetings } from "./meeting-match.ts"

const hit = (title: string) => matchMeeting([title])

assert.deepEqual(hit("Meet – abc-defg-hij"), {
  source: "Google Meet",
  title: "Meet – abc-defg-hij",
  key: "meet:abc-defg-hij",
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

// The same call, retitled by a chat badge or a browser suffix, keeps one key — this is
// what stops the banner from firing again every time the window title churns.
const stableKey = "meet:abc-defg-hij"
for (const variant of [
  "Meet – abc-defg-hij",
  "(3) Meet – abc-defg-hij",
  "Meet – abc-defg-hij - Google Chrome",
  "(12) Meet – abc-defg-hij — Mozilla Firefox",
  "Meet - abc-defg-hij",
  "Meet —  abc-defg-hij ",
]) {
  assert.equal(hit(variant)?.key, stableKey, `unstable key for: ${variant}`)
}

assert.equal(
  hit("(3) Meet – abc-defg-hij")?.title,
  "Meet – abc-defg-hij",
  "the badge is stripped from the displayed title too"
)

assert.notEqual(
  hit("Meet – abc-defg-hij")?.key,
  hit("Meet – zzz-yyyy-xxx")?.key,
  "a different call is a different key"
)

// A named call carries no meeting code, so its title is the identity.
assert.equal(hit("Meet - Weekly sync")?.key, "meet:meet - weekly sync")
assert.equal(
  hit("(1) Meet - Weekly sync")?.key,
  hit("Meet - Weekly sync")?.key,
  "a named call still normalises to one key"
)

assert.deepEqual(
  matchMeetings(["Meet – abc-defg-hij", "(2) Meet – abc-defg-hij"]).map(
    (m) => m.key
  ),
  [stableKey],
  "two windows of one call are one meeting"
)

assert.deepEqual(
  matchMeetings(["Meet – abc-defg-hij", "Zoom Meeting", "Slack"]).map(
    (m) => m.key
  ),
  [stableKey, "zoom:meeting"],
  "separate calls are reported separately"
)

assert.deepEqual(matchMeetings(["Slack", "Mail"]), [])

console.log("meeting-match: all checks passed")
