import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Instance } from "../../project/instance"
import { fetchIndex, resolveToken, invalidateAccessCache } from "../../costrict/registry/client"
import { install, uninstall } from "../../costrict/registry/install"
import * as Record from "../../costrict/registry/record"
import { AlreadyInstalledError, ForbiddenError, NotLoggedInError, UnauthorizedError } from "../../costrict/registry/types"
import type { InstallScope, RegistryItem } from "../../costrict/registry/types"
import { getCoStrictBaseURL } from "../../costrict/provider/auth"

const DEFAULT_ORG = "public"

function registryBase(): string {
  const env = process.env.COSTRICT_REGISTRY_BASE_URL
  if (env) return env.replace(/\/$/, "")
  return `${getCoStrictBaseURL()}/registry`
}

function resolveRegistryUrl(slug: string | undefined): { registryUrl: string; itemSlug: string | undefined } {
  const base = registryBase()
  if (!slug) return { registryUrl: `${base}/${DEFAULT_ORG}`, itemSlug: undefined }
  const sep = slug.indexOf("/")
  if (sep === -1) return { registryUrl: `${base}/${DEFAULT_ORG}`, itemSlug: slug }
  return { registryUrl: `${base}/${slug.slice(0, sep)}`, itemSlug: slug.slice(sep + 1) }
}

function formatError(err: unknown): string {
  if (err instanceof NotLoggedInError) return err.message
  if (err instanceof UnauthorizedError) return err.message
  if (err instanceof ForbiddenError) return err.message
  if (err instanceof AlreadyInstalledError) return err.message
  return err instanceof Error ? err.message : String(err)
}

async function resolveScope(interactive: boolean): Promise<InstallScope> {
  if (!interactive) return "global"
  const project = Instance.project
  if (project.vcs !== "git") return "global"
  const result = await prompts.select<InstallScope>({
    message: "Install location",
    options: [
      { label: "Global", value: "global", hint: "available in all projects" },
      { label: "Current project", value: "project", hint: Instance.worktree },
    ],
  })
  if (prompts.isCancel(result)) throw new UI.CancelledError()
  return result
}

const PluginAddCommand = cmd({
  command: "add [slug]",
  describe: "install an extension from the registry",
  builder: (yargs) =>
    yargs
      .positional("slug", { type: "string", describe: "extension slug, optionally prefixed with org (org/slug)" })
      .option("global", { type: "boolean", alias: "g", describe: "install globally" }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Install extension")

        const { registryUrl, itemSlug } = resolveRegistryUrl(args.slug)

        const spinner = prompts.spinner()
        spinner.start("Fetching registry...")

        let index
        try {
          index = await fetchIndex(registryUrl)
          spinner.stop(`Found ${index.items.length} extension(s)`)
        } catch (err) {
          spinner.stop("Failed to fetch registry", 1)
          prompts.log.error(formatError(err))
          prompts.outro("Done")
          return
        }

        if (!index.items.length) {
          prompts.log.warn("No extensions available in this registry")
          prompts.outro("Done")
          return
        }

        let item: RegistryItem
        if (itemSlug) {
          const found = index.items.find((i) => i.slug === itemSlug)
          if (!found) {
            prompts.log.error(`Extension not found: ${itemSlug}`)
            prompts.outro("Done")
            return
          }
          item = found
        } else {
          const installed = await Record.all()
          const installedSlugs = new Set(installed.map((i) => i.slug))
          const options = index.items.map((i) => ({
            label: i.name,
            value: i.slug,
            hint: `${i.type}${installedSlugs.has(i.slug) ? " · installed" : ""} — ${i.description}`,
          }))
          const selected = await prompts.select({ message: "Select extension", options })
          if (prompts.isCancel(selected)) throw new UI.CancelledError()
          item = index.items.find((i) => i.slug === selected)!
        }

        const existing = await Record.get(item.slug)
        if (existing) {
          prompts.log.warn(`${item.slug} is already installed. Run: cs plugin update ${item.slug}`)
          prompts.outro("Done")
          return
        }

        const scope: InstallScope = args.global ? "global" : await resolveScope(true)

        const installSpinner = prompts.spinner()
        installSpinner.start(`Installing ${item.name}...`)

        try {
          await install(item, registryUrl, scope)
          await Record.add(Record.make(item, registryUrl, scope))
          installSpinner.stop(`${item.name} installed`)
        } catch (err) {
          installSpinner.stop("Installation failed", 1)
          prompts.log.error(formatError(err))
        }

        prompts.outro("Done")
      },
    })
  },
})

const PluginRemoveCommand = cmd({
  command: "remove <slug>",
  aliases: ["rm"],
  describe: "remove an installed extension",
  builder: (yargs) =>
    yargs.positional("slug", { type: "string", describe: "extension slug", demandOption: true }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Remove extension")

        const entry = await Record.get(args.slug!)
        if (!entry) {
          prompts.log.error(`${args.slug} is not installed`)
          prompts.outro("Done")
          return
        }

        const spinner = prompts.spinner()
        spinner.start(`Removing ${entry.name}...`)

        try {
          await uninstall(entry)
          await Record.remove(args.slug!)
          spinner.stop(`${entry.name} removed`)
        } catch (err) {
          spinner.stop("Removal failed", 1)
          prompts.log.error(formatError(err))
        }

        prompts.outro("Done")
      },
    })
  },
})

const PluginListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list installed extensions",
  async handler() {
    UI.empty()
    prompts.intro("Installed extensions")

    const items = await Record.all()
    if (!items.length) {
      prompts.log.warn("No extensions installed")
      prompts.outro("Run: cs plugin add")
      return
    }

    for (const item of items) {
      prompts.log.info(
        `${item.name} ${UI.Style.TEXT_DIM}${item.type} · ${item.scope} · ${item.registry}`,
      )
    }

    prompts.outro(`${items.length} extension(s)`)
  },
})

const PluginUpdateCommand = cmd({
  command: "update [slug]",
  describe: "re-fetch and update an installed extension",
  builder: (yargs) =>
    yargs.positional("slug", { type: "string", describe: "extension slug (omit to update all)" }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Update extension(s)")

        const all = await Record.all()
        const targets = args.slug ? all.filter((i) => i.slug === args.slug) : all

        if (!targets.length) {
          prompts.log.warn(args.slug ? `${args.slug} is not installed` : "No extensions installed")
          prompts.outro("Done")
          return
        }

        for (const entry of targets) {
          const spinner = prompts.spinner()
          spinner.start(`Updating ${entry.name}...`)

          try {
            await invalidateAccessCache(entry.registry)
            const index = await fetchIndex(entry.registry)
            const item = index.items.find((i) => i.slug === entry.slug)
            if (!item) {
              spinner.stop(`${entry.slug} not found in registry`, 1)
              continue
            }
            await uninstall(entry)
            await install(item, entry.registry, entry.scope)
            await Record.add(Record.make(item, entry.registry, entry.scope))
            spinner.stop(`${entry.name} updated`)
          } catch (err) {
            spinner.stop(`Failed to update ${entry.name}`, 1)
            prompts.log.error(formatError(err))
          }
        }

        prompts.outro("Done")
      },
    })
  },
})

export const PluginCommand = cmd({
  command: "plugin",
  describe: "manage extensions (skills, agents, commands, mcp)",
  builder: (yargs) =>
    yargs
      .command(PluginAddCommand)
      .command(PluginRemoveCommand)
      .command(PluginListCommand)
      .command(PluginUpdateCommand)
      .demandCommand(),
  async handler() {},
})
