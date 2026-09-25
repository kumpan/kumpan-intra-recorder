import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"

const alias = {
  "@": resolve(__dirname, "src"),
}

export default defineConfig({
  main: {
    // electron-liquid-glass is an optionalDependency (macOS-only native addon), which
    // externalizeDepsPlugin doesn't pick up on its own.
    plugins: [externalizeDepsPlugin({ include: ["electron-liquid-glass"] })],
    resolve: { alias },
    build: {
      lib: { entry: "src/main/index.ts" },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      lib: { entry: "src/preload/index.ts" },
    },
  },
  renderer: {
    root: "src/renderer",
    plugins: [react()],
    resolve: { alias },
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
  },
})
