import assert from "node:assert/strict"
import {
  matchMeeting,
  matchMeetings,
  micHits,
  parseWindowsMicUsers,
} from "./meeting-match.ts"

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

assert.deepEqual(micHits(["Search"]), [
  {
    source: "Search",
    title: "Using your microphone",
    key: "mic:Search",
    viaMic: true,
  },
])

{
  const root =
    "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\microphone"
  const own =
    "C:\\Users\\per\\AppData\\Local\\Programs\\kumpan-intra-recorder\\Kumpan Intra Recorder.exe"
  const reg = [
    root,
    "    Value    REG_SZ    Allow",
    "",
    `${root}\\MicrosoftTeams_8wekyb3d8bbwe`,
    "    Value    REG_SZ    Allow",
    "    LastUsedTimeStart    REG_QWORD    0x1db2c5e4a1b2c3d",
    "    LastUsedTimeStop    REG_QWORD    0x0",
    "",
    `${root}\\Microsoft.WindowsSoundRecorder_8wekyb3d8bbwe`,
    "    LastUsedTimeStart    REG_QWORD    0x1db2c5e4a1b2c3d",
    "    LastUsedTimeStop    REG_QWORD    0x1db2c5e4a1b9999",
    "",
    `${root}\\NonPackaged`,
    "    Value    REG_SZ    Allow",
    "",
    `${root}\\NonPackaged\\C:#Program Files#Google#Chrome#Application#chrome.exe`,
    "    LastUsedTimeStart    REG_QWORD    0x1db2c5e4a1b2c3d",
    "    LastUsedTimeStop    REG_QWORD    0x0",
    "",
    `${root}\\NonPackaged\\${own.replace(/\\/g, "#")}`,
    "    LastUsedTimeStart    REG_QWORD    0x1db2c5e4a1b2c3d",
    "    LastUsedTimeStop    REG_QWORD    0x0",
    "",
    `${root}\\NonPackaged\\C:#Tools#never_used.exe`,
    "    LastUsedTimeStart    REG_QWORD    0x0",
    "    LastUsedTimeStop    REG_QWORD    0x0",
  ].join("\r\n")
  assert.deepEqual(
    parseWindowsMicUsers(reg, own),
    ["Chrome", "MicrosoftTeams"],
    "apps recording now, minus stopped, never-used and the recorder itself"
  )
}

console.log("meeting-match: all checks passed")
