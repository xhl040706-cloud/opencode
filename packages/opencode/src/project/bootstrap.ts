import { Plugin } from "../plugin"
import { Format } from "../format"
import { LSP } from "../lsp"
import { File } from "../file"
import { FileWatcher } from "../file/watcher"
import { Snapshot } from "../snapshot"
import { Project } from "./project"
import { Vcs } from "./vcs"
import { Bus } from "../bus"
import { Command } from "../command"
import { Instance } from "./instance"
import { Log } from "@/util/log"
import { ShareNext } from "@/share/share-next"
import { registerDynamicConfigReload } from "./dynamic-config-reload"

export async function InstanceBootstrap() {
  Log.Default.info("bootstrapping", { directory: Instance.directory })
  const t0 = Date.now()
  let t1: number
  t1 = Date.now(); await Plugin.init(); console.log(`[perf.bootstrap] Plugin.init=${Date.now() - t1}ms`)
  t1 = Date.now(); ShareNext.init(); console.log(`[perf.bootstrap] ShareNext.init=${Date.now() - t1}ms`)
  t1 = Date.now(); Format.init(); console.log(`[perf.bootstrap] Format.init=${Date.now() - t1}ms`)
  t1 = Date.now(); await LSP.init(); console.log(`[perf.bootstrap] LSP.init=${Date.now() - t1}ms`)
  t1 = Date.now(); File.init(); console.log(`[perf.bootstrap] File.init=${Date.now() - t1}ms`)
  t1 = Date.now(); FileWatcher.init(); console.log(`[perf.bootstrap] FileWatcher.init=${Date.now() - t1}ms`)
  t1 = Date.now(); Vcs.init(); console.log(`[perf.bootstrap] Vcs.init=${Date.now() - t1}ms`)
  t1 = Date.now(); Snapshot.init(); console.log(`[perf.bootstrap] Snapshot.init=${Date.now() - t1}ms`)
  t1 = Date.now(); registerDynamicConfigReload(); console.log(`[perf.bootstrap] registerDynamicConfigReload=${Date.now() - t1}ms`)
  console.log(`[perf.bootstrap] TOTAL=${Date.now() - t0}ms`)

  Bus.subscribe(Command.Event.Executed, async (payload) => {
    if (payload.properties.name === Command.Default.INIT) {
      Project.setInitialized(Instance.project.id)
    }
  })
}
