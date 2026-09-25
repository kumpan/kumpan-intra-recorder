import { app, dialog } from "electron"
import {
  getLastLaunchedVersion,
  updateLastLaunchedVersion,
} from "@/main/settings-store"
import { resetAndQuitForScreenRecording } from "@/main/permissions"

export async function maybeShowUpdateNotice(): Promise<void> {
  const current = app.getVersion()
  const previous = getLastLaunchedVersion()

  await updateLastLaunchedVersion(current)

  if (process.platform !== "darwin") return
  if (previous === null || previous === current) return
  // Builds up to 0.1.5 were unsigned, so macOS keyed the grant to that exact binary.
  // Signed builds keep it across updates; only this one jump needs a re-grant.
  if (!/^0\.1\.[0-5]$/.test(previous)) return

  const result = await dialog.showMessageBox({
    type: "info",
    buttons: ["Reset & Quit (recommended)", "I'll do it later"],
    defaultId: 0,
    cancelId: 1,
    title: `Updated to ${current}`,
    message: `Kumpan Intra Recorder was updated from ${previous} to ${current}.`,
    detail:
      "This version is signed by Kumpan, so future updates keep your Screen Recording permission. The one you gave the old unsigned version doesn't carry over, though, and recording will fail until you re-grant it once.\n\n" +
      "Click \"Reset & Quit\" to clear the stale permission entry and quit the app. Reopen Kumpan Intra Recorder from Applications, click Start Recording, and macOS will ask for fresh permission — grant it and accept the \"Quit & Reopen\" prompt that follows.",
  })

  if (result.response === 0) {
    await resetAndQuitForScreenRecording()
  }
}
