import { defineConfig, loadEnv } from "vite"
import desktopPlugin from "./vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_")
  const host = env.VITE_OPENCODE_SERVER_HOST ?? "localhost"
  const port = env.VITE_OPENCODE_SERVER_PORT ?? "8080"
  const target = `http://${host}:${port}`

  const cloudHost = env.VITE_CLOUD_SERVER_HOST ?? "localhost"
  const cloudPort = env.VITE_CLOUD_SERVER_PORT ?? "8080"
  const cloudTarget = `http://${cloudHost}:${cloudPort}`

  return {
  base: './',
  plugins: [desktopPlugin] as any,
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 3000,
    proxy: {
      "/cloud/device": {
        target: cloudTarget,
        changeOrigin: true,
        ws: true,
      },
      "/cloud": {
        target,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: "esnext",
    // sourcemap: true,
  },
  }
})
