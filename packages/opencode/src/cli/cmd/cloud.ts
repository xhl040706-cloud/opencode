import { spawn } from "child_process"
import fs from "fs"
import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { register } from "../../costrict/device/client"
import { connect } from "../../costrict/device/tunnel"
import { initCloudNotifier } from "../../costrict/device/notify"
import { Daemon } from "../../costrict/device/daemon"
import { Log } from "../../util/log"
import { Flag } from "../../flag/flag"

const log = Log.create({ service: "cloud-cmd" })

const READY_TIMEOUT_MS = 30_000

async function runWorker() {
  Log.useStderr()

  // Handle TLS certificate verification setting before any network requests
  if (Flag.COSTRICT_INSECURE_SKIP_TLS_VERIFY) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
    log.warn("TLS certificate verification is disabled (COSTRICT_INSECURE_SKIP_TLS_VERIFY=true) - this is insecure!")
  }

  const device = await register()
  console.log(`device registered: ${device.device_id}`)

  initCloudNotifier(device.base_url, device.device_token, device.device_id)

  const server = Server.listen({ port: 0, hostname: "127.0.0.1" })
  console.log(`internal server on port ${server.port}`)

  connect(server.port!).catch((e) => log.error("tunnel fatal", { error: e?.message ?? e }))

  if (process.send) {
    process.send({ ready: true, pid: process.pid })
  }

  await new Promise(() => {})
}

async function startDaemon() {
  const { running, pid } = Daemon.status()
  if (running) {
    console.log(`cloud daemon already running (pid: ${pid})`)
    return
  }

  const entry = process.argv[1]
  const logFd = Daemon.openLogFd()

  const child = spawn(process.execPath, [entry, "cloud", "_worker"], {
    detached: true,
    windowsHide: true,
    stdio: ["ignore", logFd, logFd, "ipc"],
    env: process.env,
  })

  child.unref()

  const ready = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), READY_TIMEOUT_MS)
    child.on("message", (msg: any) => {
      if (msg?.ready) {
        clearTimeout(timer)
        resolve(true)
      }
    })
    child.on("exit", () => {
      clearTimeout(timer)
      resolve(false)
    })
  })

  fs.closeSync(logFd)

  if (!ready || !child.pid) {
    console.error("cloud daemon failed to start, check logs: " + Daemon.logFile())
    process.exit(1)
  }

  Daemon.writePid(child.pid)
  console.log(`cloud daemon started (pid: ${child.pid})`)
  console.log(`logs: cs cloud logs`)
}

export const CloudCommand = cmd({
  command: "cloud [command]",
  describe: "manage cloud daemon (register device and connect via WebSocket tunnel)",
  builder: (yargs) =>
    yargs
      .command("start", "start cloud daemon", {}, async () => {
        await startDaemon()
      })
      .command("stop", "stop cloud daemon", {}, () => {
        const stopped = Daemon.stop()
        console.log(stopped ? "cloud daemon stopped" : "cloud daemon is not running")
      })
      .command("status", "show cloud daemon status", {}, () => {
        const { running, pid } = Daemon.status()
        if (running) {
          console.log(`running (pid: ${pid})`)
          console.log(`logs: ${Daemon.logFile()}`)
        } else {
          console.log("not running")
        }
      })
      .command(
        "logs",
        "tail cloud daemon logs",
        (y) =>
          y
            .option("lines", { alias: "n", type: "number", default: 100, describe: "number of lines to show" })
            .option("follow", { alias: "f", type: "boolean", default: false, describe: "follow log output" }),
        (args) => {
          Daemon.tailLogs(args.lines, args.follow)
        },
      )
      .command("restart", "restart cloud daemon", {}, async () => {
        const stopped = Daemon.stop()
        if (stopped) console.log("cloud daemon stopped")
        await startDaemon()
      })
      .command("_worker", false, {}, async () => {
        await runWorker()
      }),
  handler: async () => {
    console.error("specify a subcommand: start, stop, restart, status, logs")
    process.exit(1)
  },
})
