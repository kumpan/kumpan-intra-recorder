import assert from "node:assert/strict"
import { createMeetingTracker } from "./meeting-tracker.ts"

const GONE_AFTER_MS = 90_000
const REMEMBER_MS = 3 * 60 * 60_000
const SETTLE_MS = 30_000
const MIN = 60_000

const call = (key: string, title = key) => ({
  source: "Google Meet",
  title,
  key,
})

const mic = (app: string) => ({
  source: app,
  title: "Using your microphone",
  key: `mic:${app}`,
  viaMic: true,
})

const tracker = () =>
  createMeetingTracker({
    goneAfterMs: GONE_AFTER_MS,
    rememberNudgedMs: REMEMBER_MS,
    micSettleMs: SETTLE_MS,
  })

{
  const t = tracker()
  t.update([call("meet:a")], 0)
  assert.equal(t.takeNudge(0)?.key, "meet:a", "a new call earns a banner")
  assert.equal(t.takeNudge(0), null, "and only ever one")

  t.update([call("meet:a")], 12_000)
  assert.equal(
    t.takeNudge(12_000),
    null,
    "still the same call on the next poll"
  )
}

{
  // The title churning is the everyday case: a chat badge, a tab switch back, the
  // meeting name being edited. Same key, so no second banner.
  const t = tracker()
  t.update([call("meet:a", "Meet – abc-defg-hij")], 0)
  t.takeNudge(0)
  const liveAfterRetitle = t.update(
    [call("meet:a", "(2) Meet – abc-defg-hij")],
    12_000
  )
  assert.equal(t.takeNudge(12_000), null, "a retitled call is not a new call")
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
  t.takeNudge(0)
  assert.deepEqual(
    t.update([], 12_000).map((m) => m.key),
    ["meet:a"],
    "a call missing from one poll is still live"
  )
  assert.deepEqual(
    t.update([], GONE_AFTER_MS).map((m) => m.key),
    ["meet:a"]
  )
}

{
  // The reported bug: away from the Meet tab for a few minutes, then back.
  const t = tracker()
  t.update([call("meet:a")], 0)
  t.takeNudge(0)
  assert.deepEqual(t.update([], 5 * MIN), [], "gone from view past grace")
  assert.equal(t.has("meet:a"), false, "and not live for the stop reminder")
  t.update([call("meet:a")], 6 * MIN)
  assert.equal(t.takeNudge(6 * MIN), null, "coming back is not a new call")
}

{
  const t = tracker()
  t.update([call("meet:a")], 0)
  t.takeNudge(0)
  t.update([], REMEMBER_MS + 1)
  t.update([call("meet:a")], REMEMBER_MS + 2)
  assert.equal(
    t.takeNudge(REMEMBER_MS + 2)?.key,
    "meet:a",
    "the same code hours later is the next occurrence, worth a new banner"
  )
}

{
  const t = tracker()
  t.update([call("meet:a"), call("meet:b")], 0)
  assert.equal(t.takeNudge(0)?.key, "meet:a")
  assert.equal(t.takeNudge(0)?.key, "meet:b", "each call gets its own banner")
  assert.equal(t.takeNudge(0), null)
}

{
  // Recording started before the call showed up: stopping must not then offer to
  // record the call that was just recorded.
  const t = tracker()
  t.update([call("meet:a")], 0)
  t.markLiveNudged()
  t.update([call("meet:a")], 12_000)
  assert.equal(t.takeNudge(12_000), null)
}

{
  // A browser that never titles its window after the tab: only the mic gives it away.
  const t = tracker()
  t.update([mic("Search")], 0)
  assert.equal(t.takeNudge(0), null, "a mic hit waits to settle")
  t.update([mic("Search")], 24_000)
  assert.equal(t.takeNudge(24_000), null)
  t.update([mic("Search")], 36_000)
  assert.equal(t.takeNudge(36_000)?.key, "mic:Search", "a settled one nudges")
  t.update([mic("Search")], 48_000)
  assert.equal(t.takeNudge(48_000), null, "once")
}

{
  // Chrome in a Meet call shows up twice — by title and by mic. One call, one banner,
  // including after the user tabs away from the title for good.
  const t = tracker()
  t.update([call("meet:a"), mic("Google Chrome")], 0)
  assert.equal(t.takeNudge(0)?.key, "meet:a")
  for (let at = 12_000; at <= 10 * MIN; at += 12_000) {
    t.update([mic("Google Chrome")], at)
    assert.equal(
      t.takeNudge(at),
      null,
      `no mic banner for the same call at ${at}`
    )
  }
}

{
  const t = tracker()
  t.update([mic("Search")], 0)
  t.update([mic("Search")], SETTLE_MS)
  assert.equal(t.takeNudge(SETTLE_MS)?.key, "mic:Search")
  t.update([], SETTLE_MS + GONE_AFTER_MS + 1)
  t.update([mic("Search")], 20 * MIN)
  t.update([mic("Search")], 20 * MIN + SETTLE_MS)
  assert.equal(
    t.takeNudge(20 * MIN + SETTLE_MS)?.key,
    "mic:Search",
    "the mic released and taken again is a new call: the key is the app, not the call"
  )
}

{
  const t = tracker()
  t.update([call("meet:a")], 0)
  t.clear()
  assert.deepEqual(t.live(), [])
  assert.equal(t.has("meet:a"), false)
}

console.log("meeting-tracker: all checks passed")
