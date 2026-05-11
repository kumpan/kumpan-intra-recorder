import { BrowserWindow, shell } from "electron"
import { join } from "node:path"

let settingsWindow: BrowserWindow | null = null
let recorderWindow: BrowserWindow | null = null
let postRecordingWindow: BrowserWindow | null = null

const preloadPath = (): string => join(__dirname, "../preload/index.js")

function loadView(
  window: BrowserWindow,
  view: "settings" | "recorder" | "post-recording"
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

export function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show()
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 460,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Kumpan Recorder — Settings",
    show: false,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  settingsWindow.once("ready-to-show", () => {
    settingsWindow?.show()
  })

  settingsWindow.on("closed", () => {
    settingsWindow = null
  })

  settingsWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  loadView(settingsWindow, "settings")
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

export function openPostRecordingWindow(): BrowserWindow {
  if (postRecordingWindow && !postRecordingWindow.isDestroyed()) {
    postRecordingWindow.show()
    postRecordingWindow.focus()
    return postRecordingWindow
  }

  postRecordingWindow = new BrowserWindow({
    width: 440,
    height: 340,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Recording finished",
    show: false,
    alwaysOnTop: true,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  postRecordingWindow.once("ready-to-show", () => {
    postRecordingWindow?.show()
    postRecordingWindow?.focus()
  })

  postRecordingWindow.on("closed", () => {
    postRecordingWindow = null
  })

  postRecordingWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  loadView(postRecordingWindow, "post-recording")
  return postRecordingWindow
}

export function closePostRecordingWindow(): void {
  if (postRecordingWindow && !postRecordingWindow.isDestroyed()) {
    postRecordingWindow.close()
  }
  postRecordingWindow = null
}
