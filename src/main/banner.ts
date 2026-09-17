import { IpcChannel } from "@/shared/ipc"
import type { MeetingBannerContext } from "@/shared/types"
import {
  closeMeetingBanner,
  getMeetingBannerWindow,
  openMeetingBanner,
} from "@/main/windows"

export type BannerHandlers = {
  onAccept: () => void | Promise<void>
  onDismiss: () => void
}

let context: MeetingBannerContext | null = null
let handlers: BannerHandlers | null = null

export function showBanner(
  next: MeetingBannerContext,
  nextHandlers: BannerHandlers
): void {
  context = next
  handlers = nextHandlers
  openMeetingBanner(
    next.kind === "stop" ? "Still recording" : "Meeting detected"
  )
  // The renderer reads the context once on mount, so a banner that is already up — the
  // start prompt being replaced by the stop prompt — only learns of the swap from here.
  getMeetingBannerWindow()?.webContents.send(
    IpcChannel.MeetingBannerUpdate,
    next
  )
}

export function hideBanner(): void {
  if (!context) return
  context = null
  handlers = null
  closeMeetingBanner()
}

export function getBannerContext(): MeetingBannerContext | null {
  return context
}

export async function acceptBanner(): Promise<void> {
  const current = handlers
  hideBanner()
  await current?.onAccept()
}

export function dismissBanner(): void {
  const current = handlers
  hideBanner()
  current?.onDismiss()
}
