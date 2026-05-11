import type { RecorderApi } from "@/preload/index"

declare global {
  interface Window {
    api: RecorderApi
  }
}

export {}
