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
  if (previous === null) return
  if (previous === current) return

  const result = await dialog.showMessageBox({
    type: "info",
    buttons: ["Reset & Quit (recommended)", "I'll do it later"],
    defaultId: 0,
    cancelId: 1,
    title: `Updated to ${current}`,
    message: `Kumpan Intra Recorder was updated from ${previous} to ${current}.`,
    detail:
      "Because the app is unsigned, macOS treats this update as a different binary than the one you previously granted Screen Recording permission to. Recording will fail until you re-grant it.\n\n" +
      "Click \"Reset & Quit\" to clear the stale permission entry and quit the app. Reopen Kumpan Intra Recorder from Applications, click Start Recording, and macOS will ask for fresh permission — grant it and accept the \"Quit & Reopen\" prompt that follows.",
  })

  if (result.response === 0) {
    await resetAndQuitForScreenRecording()
  }
}
