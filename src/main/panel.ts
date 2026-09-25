import { app, BrowserWindow, screen, shell } from "electron"
import { IpcChannel } from "@/shared/ipc"
import type { PanelState } from "@/shared/types"
import { loadView, preloadPath } from "@/main/windows"
import { getRecorderState } from "@/main/recorder-session"
import { getPending } from "@/main/recording-handoff"
import { getUpdateState } from "@/main/updater"
import { getHotkey } from "@/main/settings-store"
import { getTrayBounds } from "@/main/tray"

const WIDTH = 320
const RADIUS = 16
const GAP = 6
// Clicking the tray icon while the panel is open blurs it first; without this the
// same click would reopen what the blur just closed.
const REOPEN_GUARD_MS = 300

type LiquidGlass = {
  addView(handle: Buffer, options: { cornerRadius?: number }): number
}

let panel: BrowserWindow | null = null
let height = 160
let glass = false
let pinned = 0
let hiddenAt = 0
const listeners: Array<(state: PanelState) => void> = []

export function panelState(): PanelState {
  return {
    recorder: getRecorderState(),
    pending: getPending(),
    update: getUpdateState(),
    version: app.getVersion(),
    hotkey: getHotkey(),
    glass,
  }
}

export function onPanelState(listener: (state: PanelState) => void): void {
  listeners.push(listener)
}

export function refreshPanel(): void {
  const state = panelState()
  live()?.webContents.send(IpcChannel.PanelStateChanged, state)
  for (const listener of listeners) listener(state)
}

function live(): BrowserWindow | null {
  return panel && !panel.isDestroyed() ? panel : null
}

// Liquid Glass on macOS 26+, the addon's own blur on older macOS. It is a Mac-only
// optional dependency, so Windows (or a native load failure) gets the CSS card.
function applyGlass(win: BrowserWindow): boolean {
  if (process.platform !== "darwin") return false
  try {
    const liquidGlass = require("electron-liquid-glass") as LiquidGlass
    return (
      liquidGlass.addView(win.getNativeWindowHandle(), {
        cornerRadius: RADIUS,
      }) >= 0
    )
  } catch {
    return false
  }
}

function create(): BrowserWindow {
  const win = new BrowserWindow({
    width: WIDTH,
    height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  // Opened from the menu bar over a fullscreen Meet call, it has to float above it.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.on("blur", () => {
    if (pinned === 0) hidePanel()
  })
  win.on("closed", () => {
    panel = null
  })
  win.webContents.once("did-finish-load", () => {
    win.setTitle("Kumpan Recorder")
    glass = applyGlass(win)
    refreshPanel()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: "deny" }
  })
  loadView(win, "panel")
  return win
}

function place(win: BrowserWindow): void {
  const tray = getTrayBounds()
  const { workArea } = screen.getDisplayMatching(tray)
  const centred = Math.round(tray.x + tray.width / 2 - WIDTH / 2)
  const x = Math.min(
    Math.max(centred, workArea.x + GAP),
    workArea.x + workArea.width - WIDTH - GAP
  )
  // Menu bar on top (macOS), taskbar usually at the bottom (Windows).
  const fromTop = tray.y < workArea.y + workArea.height / 2
  const y = fromTop
    ? workArea.y + GAP
    : workArea.y + workArea.height - height - GAP
  win.setBounds({ x, y, width: WIDTH, height })
}

function reveal(win: BrowserWindow): void {
  win.show()
  win.focus()
}

export function showPanel(): BrowserWindow {
  const win = live() ?? (panel = create())
  place(win)
  if (win.webContents.isLoading()) win.once("ready-to-show", () => reveal(win))
  else reveal(win)
  return win
}

export function hidePanel(): void {
  const win = live()
  if (!win?.isVisible()) return
  hiddenAt = Date.now()
  win.hide()
}

export function togglePanel(): void {
  if (live()?.isVisible()) return hidePanel()
  if (Date.now() - hiddenAt < REOPEN_GUARD_MS) return
  showPanel()
}

export function resizePanel(next: number): void {
  height = Math.max(1, Math.ceil(next))
  const win = live()
  if (win) place(win)
}

// A native dialog takes focus from the panel; keep it open underneath instead of
// letting the blur hide what the dialog is about.
export async function whilePanelPinned<T>(fn: () => Promise<T>): Promise<T> {
  pinned++
  try {
    return await fn()
  } finally {
    pinned--
    const win = live()
    if (win?.isVisible()) win.focus()
  }
}
