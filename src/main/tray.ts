import { app, Tray, nativeImage, nativeTheme, screen } from "electron"
import type { Rectangle } from "electron"
import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { promisify } from "node:util"
import type { PanelState } from "@/shared/types"
import { onRecorderState } from "@/main/recorder-session"
import {
  onPanelState,
  panelState,
  refreshPanel,
  togglePanel,
} from "@/main/panel"

const execFileAsync = promisify(execFile)

const PERSONALIZE_KEY =
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"
const TASKBAR_RECHECK_MS = 30_000

let tray: Tray | null = null
let taskbarLight = false

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
  const path = taskbarLight
    ? resolveAsset("trayIcon-black.png", "trayIconTemplate.png")
    : resolveAsset("trayIcon-white.png", "trayIconTemplate.png")
  return nativeImage.createFromPath(path)
}

// The taskbar has its own light/dark setting, apart from the one apps follow (which
// this app overrides to dark anyway), and Electron 34 doesn't expose it. A missing key
// is a Windows 10 build from before light taskbars existed.
async function refreshTaskbarTheme(): Promise<void> {
  const { stdout } = await execFileAsync("reg", [
    "query",
    PERSONALIZE_KEY,
    "/v",
    "SystemUsesLightTheme",
  ]).catch(() => ({ stdout: "" }))
  const light = /SystemUsesLightTheme\s+REG_DWORD\s+0x1\b/i.test(stdout)
  if (light === taskbarLight) return
  taskbarLight = light
  applyTrayImage()
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
  if (process.platform === "win32") {
    void refreshTaskbarTheme()
    // Nothing reliably announces a taskbar theme change, so look again now and then.
    setInterval(() => void refreshTaskbarTheme(), TASKBAR_RECHECK_MS)
    nativeTheme.on("updated", () => void refreshTaskbarTheme())
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
