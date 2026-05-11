import { defineConfig, externalizeDepsPlugin } from "electron-vite"
import react from "@vitejs/plugin-react"
import { resolve } from "node:path"

const alias = {
  "@": resolve(__dirname, "src"),
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
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
