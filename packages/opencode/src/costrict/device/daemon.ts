import fs from "fs"
import path from "path"
import { Global } from "../../global"

const PID_FILE = path.join(Global.Path.state, "cloud.pid")
const LOG_FILE = path.join(Global.Path.log, "cloud.log")

export namespace Daemon {
  export function pidFile() {
    return PID_FILE
  }

  export function logFile() {
    return LOG_FILE
  }

  export function readPid(): number | null {
    try {
      const raw = fs.readFileSync(PID_FILE, "utf8").trim()
      const pid = parseInt(raw, 10)
      return Number.isFinite(pid) ? pid : null
    } catch {
      return null
    }
  }

  export function writePid(pid: number) {
    fs.mkdirSync(path.dirname(PID_FILE), { recursive: true })
    fs.writeFileSync(PID_FILE, String(pid), { mode: 0o600 })
  }

  export function removePid() {
    try {
      fs.unlinkSync(PID_FILE)
    } catch {}
  }

  export function isRunning(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  export function status(): { running: boolean; pid: number | null } {
    const pid = readPid()
    if (!pid) return { running: false, pid: null }
    const running = isRunning(pid)
    if (!running) {
      removePid()
      return { running: false, pid: null }
    }
    return { running: true, pid }
  }

  export function stop(): boolean {
    const pid = readPid()
    if (!pid || !isRunning(pid)) {
      removePid()
      return false
    }
    try {
      process.kill(pid, "SIGTERM")
    } catch {}
    removePid()
    return true
  }

  export function openLogFd(): number {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    return fs.openSync(LOG_FILE, "w")
  }

  export function tailLogs(lines: number, follow: boolean) {
    if (!fs.existsSync(LOG_FILE)) {
      console.error("No log file found.")
      return
    }

    const content = fs.readFileSync(LOG_FILE, "utf8")
    const all = content.split("\n")
    const tail = all.slice(-lines - 1)
    process.stdout.write(tail.join("\n"))

    if (!follow) return

    let size = fs.statSync(LOG_FILE).size
    const watcher = fs.watch(LOG_FILE, () => {
      try {
        const newSize = fs.statSync(LOG_FILE).size
        if (newSize <= size) return
        const fd = fs.openSync(LOG_FILE, "r")
        const buf = Buffer.alloc(newSize - size)
        fs.readSync(fd, buf, 0, buf.length, size)
        fs.closeSync(fd)
        size = newSize
        process.stdout.write(buf.toString("utf8"))
      } catch {}
    })

    process.on("SIGINT", () => {
      watcher.close()
      process.exit(0)
    })
  }
}
