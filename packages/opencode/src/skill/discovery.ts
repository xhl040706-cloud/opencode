import { NodePath } from "@effect/platform-node"
import { Effect, Layer, Path, Schema, ServiceMap } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import { withTransientReadRetry } from "@/util/effect-http-client"
import { AppFileSystem } from "@/filesystem"
import { Global } from "../global"
import { Log } from "../util/log"

export namespace Discovery {
  const skillConcurrency = 4
  const fileConcurrency = 8

  class IndexSkill extends Schema.Class<IndexSkill>("IndexSkill")({
    name: Schema.String,
    files: Schema.Array(Schema.String),
  }) {}

  class Index extends Schema.Class<Index>("Index")({
    skills: Schema.Array(IndexSkill),
  }) {}

  export interface Interface {
    readonly pull: (url: string) => Effect.Effect<string[]>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode/SkillDiscovery") {}

  async function get(url: string, dest: string, token?: string): Promise<boolean> {
    if (await Filesystem.exists(dest)) return true
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
    return fetch(url, { headers })
      .then(async (response) => {
        if (!response.ok) {
          log.error("failed to download", { url, status: response.status })
          return false
        }
        if (response.body) await Filesystem.writeStream(dest, response.body)
        return true
      })
      .catch((err) => {
        log.error("failed to download", { url, err })
        return false
      })
  }

  export async function pull(url: string, token?: string): Promise<string[]> {
    const result: string[] = []
    const base = url.endsWith("/") ? url : `${url}/`
    const index = new URL("index.json", base).href
    const cache = dir()
    const host = base.slice(0, -1)
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    log.info("fetching index", { url: index })
    const data = await fetch(index, { headers })
      .then(async (response) => {
        if (!response.ok) {
          log.error("failed to fetch index", { url: index, status: response.status })
          return undefined
        }
        return response
          .json()
          .then((json) => json as Index)
          .catch((err) => {
            log.error("failed to parse index", { url: index, err })
            return undefined
          })

          const dirs = yield* Effect.forEach(
            list,
            (skill) =>
              Effect.gen(function* () {
                const root = path.join(cache, skill.name)

                yield* Effect.forEach(
                  skill.files,
                  (file) => download(new URL(file, `${host}/${skill.name}/`).href, path.join(root, file)),
                  {
                    concurrency: fileConcurrency,
                  },
                )

    await Promise.all(
      list.map(async (skill) => {
        const root = path.join(cache, skill.name)
        await Promise.all(
          skill.files.map(async (file) => {
            const link = new URL(file, `${host}/${skill.name}/`).href
            const dest = path.join(root, file)
            await mkdir(path.dirname(dest), { recursive: true })
            await get(link, dest, token)
          }),
        )

          return dirs.filter((dir): dir is string => dir !== null)
        })

        return Service.of({ pull })
      }),
    )

  export const defaultLayer: Layer.Layer<Service> = layer.pipe(
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(AppFileSystem.defaultLayer),
    Layer.provide(NodePath.layer),
  )
}
