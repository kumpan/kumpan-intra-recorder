import { BrowserWindow, screen, shell } from "electron"
import { join } from "node:path"

let recorderWindow: BrowserWindow | null = null
let meetingBannerWindow: BrowserWindow | null = null

export const preloadPath = (): string =>
  join(__dirname, "../preload/index.js")

export function loadView(
  window: BrowserWindow,
  view: "recorder" | "panel" | "meeting-banner"
): void {
  const devUrl = process.env["ELECTRON_RENDERER_URL"]
  if (devUrl) {
    window.loadURL(`${devUrl}?view=${view}`)
  } else {
    window.loadFile(join(__dirname, "../renderer/index.html"), {
      search: `view=${view}`,
    })
  }
}

export async function ensureRecorderWindow(): Promise<BrowserWindow> {
  if (recorderWindow && !recorderWindow.isDestroyed()) {
    return recorderWindow
  }
  recorderWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })
  recorderWindow.on("closed", () => {
    recorderWindow = null
  })
  const win = recorderWindow
  await new Promise<void>((resolve) => {
    win.webContents.once("did-finish-load", () => resolve())
    loadView(win, "recorder")
  })
  return win
}

export function getRecorderWindow(): BrowserWindow | null {
  return recorderWindow && !recorderWindow.isDestroyed() ? recorderWindow : null
}

export function closeRecorderWindow(): void {
  if (recorderWindow && !recorderWindow.isDestroyed()) {
    recorderWindow.destroy()
  }
  recorderWindow = null
}

const BANNER_WIDTH = 460
const BANNER_HEIGHT = 80

export function openMeetingBanner(title: string): void {
  if (meetingBannerWindow && !meetingBannerWindow.isDestroyed()) {
    meetingBannerWindow.setTitle(title)
    meetingBannerWindow.showInactive()
    return
  }

  const { workArea } = screen.getPrimaryDisplay()

  meetingBannerWindow = new BrowserWindow({
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    x: Math.round(workArea.x + (workArea.width - BANNER_WIDTH) / 2),
    y: workArea.y + 12,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // A Meet call is usually fullscreen. Plain alwaysOnTop sits below a fullscreen
  // window on macOS; the screen-saver level plus the fullscreen-visible flag is what
  // actually floats the banner over the call the user is about to forget to record.
  meetingBannerWindow.setAlwaysOnTop(true, "screen-saver")
  meetingBannerWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  })

  meetingBannerWindow.once("ready-to-show", () => {
    // All views share index.html, so without this the banner announces itself to
    // screen readers as the tray panel.
    meetingBannerWindow?.setTitle(title)
    meetingBannerWindow?.showInactive()
  })

  meetingBannerWindow.on("closed", () => {
    meetingBannerWindow = null
  })

  loadView(meetingBannerWindow, "meeting-banner")
}

export function getMeetingBannerWindow(): BrowserWindow | null {
  return meetingBannerWindow && !meetingBannerWindow.isDestroyed()
    ? meetingBannerWindow
    : null
}

export function closeMeetingBanner(): void {
  if (meetingBannerWindow && !meetingBannerWindow.isDestroyed()) {
    meetingBannerWindow.destroy()
  }
  meetingBannerWindow = null
}
