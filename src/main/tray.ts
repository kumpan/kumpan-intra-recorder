import { app, Tray, nativeImage, nativeTheme, screen } from "electron"
import type { Rectangle } from "electron"
import { existsSync } from "node:fs"
import { join } from "node:path"
import type { PanelState } from "@/shared/types"
import { onRecorderState } from "@/main/recorder-session"
import {
  onPanelState,
  panelState,
  refreshPanel,
  togglePanel,
} from "@/main/panel"

let tray: Tray | null = null

export function resourcesDir(): string {
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
  tray.on("click", () => togglePanel())
  tray.on("right-click", () => togglePanel())
  onPanelState(applyTrayChrome)
  onRecorderState(() => refreshPanel())
  applyTrayChrome(panelState())
  if (process.platform !== "darwin") {
    nativeTheme.on("updated", () => applyTrayImage())
  }
}

export function getTrayBounds(): Rectangle {
  const bounds = tray?.getBounds()
  if (bounds && bounds.width > 0) return bounds
  // Windows reports an empty rect for an icon in the overflow flyout; the cursor is on it.
  return { ...screen.getCursorScreenPoint(), width: 0, height: 0 }
}

function applyTrayChrome(state: PanelState): void {
  if (!tray) return
  tray.setToolTip(
    state.recorder.kind === "recording"
      ? "Kumpan Intra Recorder — recording…"
      : "Kumpan Intra Recorder"
  )
  // A recording still waiting for Upload / Save / Discard outlives the panel closing;
  // the dot is what points back at it.
  if (process.platform === "darwin") tray.setTitle(state.pending ? "●" : "")
}
