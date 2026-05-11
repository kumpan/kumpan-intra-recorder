import { app, Menu, Tray, nativeImage, nativeTheme } from "electron"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { openSettingsWindow } from "@/main/windows"
import { getRecorderState, onRecorderState } from "@/main/recorder-session"
import {
  startRecordingFromTray,
  stopRecordingFromTray,
} from "@/main/recorder-controller"
import { resetAndQuitForScreenRecording } from "@/main/permissions"
import { getHotkey } from "@/main/settings-store"

let tray: Tray | null = null

function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), "resources")
}

function resolveAsset(...candidates: string[]): string {
  const dir = resourcesDir()
  for (const name of candidates) {
    const full = join(dir, name)
    if (existsSync(full)) return full
  }
  return join(dir, candidates[candidates.length - 1] ?? "")
}

function loadTrayImage(): Electron.NativeImage {
  if (process.platform === "darwin") {
    const path = resolveAsset("trayIconTemplate.png")
    const image = nativeImage.createFromPath(path)
    image.setTemplateImage(true)
    return image
  }
  const dark = nativeTheme.shouldUseDarkColors
  const path = dark
    ? resolveAsset("trayIcon-white.png", "trayIconTemplate.png")
    : resolveAsset("trayIcon-black.png", "trayIconTemplate.png")
  return nativeImage.createFromPath(path)
}

function applyTrayImage(): void {
  if (!tray) return
  const image = loadTrayImage()
  tray.setImage(image.isEmpty() ? nativeImage.createEmpty() : image)
}

export function createTray(): void {
  const image = loadTrayImage()
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  rebuildMenu()
  onRecorderState(() => rebuildMenu())
  if (process.platform !== "darwin") {
    nativeTheme.on("updated", () => applyTrayImage())
  }
}

export function rebuildTrayMenu(): void {
  rebuildMenu()
}

function rebuildMenu(): void {
  if (!tray) return
  const state = getRecorderState()

  const hotkey = getHotkey() || undefined

  let recordingItem: Electron.MenuItemConstructorOptions
  switch (state.kind) {
    case "idle":
      recordingItem = {
        label: "Start Recording",
        accelerator: hotkey,
        registerAccelerator: false,
        click: () => {
          void startRecordingFromTray()
        },
      }
      break
    case "starting":
      recordingItem = { label: "Starting…", enabled: false }
      break
    case "recording":
      recordingItem = {
        label: "Stop Recording",
        accelerator: hotkey,
        registerAccelerator: false,
        click: () => stopRecordingFromTray(),
      }
      break
    case "stopping":
      recordingItem = { label: "Stopping…", enabled: false }
      break
  }

  const tooltip =
    state.kind === "recording"
      ? "Kumpan Intra Recorder — recording…"
      : "Kumpan Intra Recorder"
  tray.setToolTip(tooltip)

  const items: Electron.MenuItemConstructorOptions[] = [
    recordingItem,
    { type: "separator" },
    { label: "Settings…", click: () => openSettingsWindow() },
  ]
  if (process.platform === "darwin") {
    items.push({
      label: "Reset Screen Recording permission…",
      click: () => {
        void resetAndQuitForScreenRecording()
      },
    })
  }
  items.push({ type: "separator" }, { label: "Quit", role: "quit" })
  tray.setContextMenu(Menu.buildFromTemplate(items))
}
