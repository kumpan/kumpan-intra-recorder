import { app, safeStorage } from "electron"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"

const DEFAULT_BASE_URL = "https://intra.kumpan.se"

export const DEFAULT_HOTKEY =
  process.platform === "darwin" ? "Control+Command+K" : "Control+Alt+K"

type PersistedSettings = {
  baseUrl: string
  token: string | null
  hotkey: string
  lastLaunchedVersion: string | null
  meetingNudge: boolean
}

const state: PersistedSettings = {
  baseUrl: DEFAULT_BASE_URL,
  token: null,
  hotkey: DEFAULT_HOTKEY,
  lastLaunchedVersion: null,
  meetingNudge: true,
}

let loaded = false

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.enc")
}

async function persist(): Promise<void> {
  const payload: PersistedSettings = {
    baseUrl: state.baseUrl,
    token: state.token,
    hotkey: state.hotkey,
    lastLaunchedVersion: state.lastLaunchedVersion,
    meetingNudge: state.meetingNudge,
  }
  const json = JSON.stringify(payload)
  const path = settingsPath()
  await mkdir(dirname(path), { recursive: true })
  if (safeStorage.isEncryptionAvailable()) {
    const buf = safeStorage.encryptString(json)
    await writeFile(path, buf)
  } else {
    await writeFile(path, json, "utf8")
  }
}

export async function loadSettings(): Promise<void> {
  if (loaded) return
  const path = settingsPath()
  if (!existsSync(path)) {
    loaded = true
    return
  }
  try {
    const raw = await readFile(path)
    let json: string
    if (safeStorage.isEncryptionAvailable()) {
      try {
        json = safeStorage.decryptString(raw)
      } catch {
        json = raw.toString("utf8")
      }
    } else {
      json = raw.toString("utf8")
    }
    const parsed = JSON.parse(json) as Partial<PersistedSettings>
    if (typeof parsed.baseUrl === "string" && parsed.baseUrl.length > 0) {
      state.baseUrl = parsed.baseUrl
    }
    if (typeof parsed.token === "string" && parsed.token.length > 0) {
      state.token = parsed.token
    }
    if (typeof parsed.hotkey === "string") {
      state.hotkey = parsed.hotkey
    }
    if (typeof parsed.lastLaunchedVersion === "string") {
      state.lastLaunchedVersion = parsed.lastLaunchedVersion
    }
    if (typeof parsed.meetingNudge === "boolean") {
      state.meetingNudge = parsed.meetingNudge
    }
  } catch (err) {
    console.error("[settings] failed to load, falling back to defaults", err)
  } finally {
    loaded = true
  }
}

export function getBaseUrl(): string {
  return state.baseUrl
}

export function getToken(): string | null {
  return state.token
}

export function hasToken(): boolean {
  return state.token !== null && state.token.length > 0
}

export function getHotkey(): string {
  return state.hotkey
}

export async function updateBaseUrl(value: string): Promise<void> {
  const trimmed = value.trim().replace(/\/$/, "")
  state.baseUrl = trimmed.length > 0 ? trimmed : DEFAULT_BASE_URL
  await persist()
}

export async function updateToken(value: string | null): Promise<void> {
  if (value === null) {
    state.token = null
  } else {
    const trimmed = value.trim()
    state.token = trimmed.length > 0 ? trimmed : null
  }
  await persist()
}

export async function updateHotkey(value: string): Promise<void> {
  state.hotkey = value.trim()
  await persist()
}

export function getMeetingNudge(): boolean {
  return state.meetingNudge
}

export async function updateMeetingNudge(value: boolean): Promise<void> {
  if (state.meetingNudge === value) return
  state.meetingNudge = value
  await persist()
}

export function getLastLaunchedVersion(): string | null {
  return state.lastLaunchedVersion
}

export async function updateLastLaunchedVersion(value: string): Promise<void> {
  if (state.lastLaunchedVersion === value) return
  state.lastLaunchedVersion = value
  await persist()
}
