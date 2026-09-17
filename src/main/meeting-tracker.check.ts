import assert from "node:assert/strict"
import { createMeetingTracker } from "./meeting-tracker.ts"

const GONE_AFTER_MS = 90_000

const call = (key: string, title = key) => ({
  source: "Google Meet",
  title,
  key,
})

const tracker = () => createMeetingTracker({ goneAfterMs: GONE_AFTER_MS })

{
  const t = tracker()
  t.update([call("meet:a")], 0)
  assert.equal(t.takeNudge()?.key, "meet:a", "a new call earns a banner")
  assert.equal(t.takeNudge(), null, "and only ever one")

  t.update([call("meet:a")], 12_000)
  assert.equal(t.takeNudge(), null, "still the same call on the next poll")
}

{
  // The title churning is the everyday case: a chat badge, a tab switch back, the
  // meeting name being edited. Same key, so no second banner.
  const t = tracker()
  t.update([call("meet:a", "Meet – abc-defg-hij")], 0)
  t.takeNudge()
  const liveAfterRetitle = t.update(
    [call("meet:a", "(2) Meet – abc-defg-hij")],
    12_000
  )
  assert.equal(t.takeNudge(), null, "a retitled call is not a new call")
  assert.equal(
    liveAfterRetitle[0]?.title,
    "(2) Meet – abc-defg-hij",
    "but the newest title is what shows"
  )
}

{
  // Switching to another tab hides the call from the poll. It has not ended.
  const t = tracker()
  t.update([call("meet:a")], 0)
  t.takeNudge()
  assert.deepEqual(
    t.update([], 12_000).map((m) => m.key),
    ["meet:a"],
    "a call missing from one poll is still live"
  )
  assert.deepEqual(
    t.update([], GONE_AFTER_MS).map((m) => m.key),
    ["meet:a"]
  )
  t.update([call("meet:a")], GONE_AFTER_MS + 12_000)
  assert.equal(
    t.takeNudge(),
    null,
    "and does not nudge again when it comes back"
  )
}

{
  const t = tracker()
  t.update([call("meet:a")], 0)
  t.takeNudge()
  assert.deepEqual(
    t.update([], GONE_AFTER_MS + 1),
    [],
    "gone past the grace window is gone"
  )
  assert.equal(t.has("meet:a"), false)

  t.update([call("meet:a")], GONE_AFTER_MS + 2)
  assert.equal(
    t.takeNudge()?.key,
    "meet:a",
    "rejoining later is a new call, worth a new banner"
  )
}

{
  const t = tracker()
  t.update([call("meet:a"), call("meet:b")], 0)
  assert.equal(t.takeNudge()?.key, "meet:a")
  assert.equal(t.takeNudge()?.key, "meet:b", "each call gets its own banner")
  assert.equal(t.takeNudge(), null)
}

{
  const t = tracker()
  t.update([call("meet:a")], 0)
  t.clear()
  assert.deepEqual(t.live(), [])
  assert.equal(t.has("meet:a"), false)
}

console.log("meeting-tracker: all checks passed")
