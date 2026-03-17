import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { register } from "../../costrict/device/client"
import { connect } from "../../costrict/device/tunnel"
import { initCloudNotifier } from "../../costrict/device/notify"

export const CloudCommand = cmd({
  command: "cloud",
  describe: "register device and connect to cloud via WebSocket tunnel",
  builder: (yargs) => yargs,
  handler: async () => {
    const device = await register()
    console.log(`device registered: ${device.device_id}`)

    initCloudNotifier(device.base_url, device.device_token, device.device_id)

    const server = Server.listen({ port: 0, hostname: "127.0.0.1" })
    console.log(`internal server on port ${server.port}`)

    connect(server.port!).catch(() => {})

    await new Promise(() => {})
  },
})
