import { createResource, createSignal, Show, For } from "solid-js"
import { useParams, useNavigate } from "@solidjs/router"
import { Icon } from "@opencode-ai/ui/icon"
import { itemApi, artifactApi, scanApi, type CapabilityItem, type ScanResult } from "../lib/api"
import { useLanguage } from "@/context/language"
import { useAuth } from "@/context/auth"
import { categoryKey } from "../lib/constants"
import SecurityBadge, { VerdictBadge, type Verdict } from "../components/security-badge"

const TYPE_META: Record<
  string,
  { color: string; back: string; label: string; icon: "sparkles" | "models" | "console" | "server" }
> = {
  skill: { color: "text-yellow-500", back: "/store/skills", label: "store.sidebar.nav.skills", icon: "sparkles" },
  subagent: { color: "text-blue-500", back: "/store/subagents", label: "store.sidebar.nav.subagents", icon: "models" },
  command: { color: "text-green-500", back: "/store/commands", label: "store.sidebar.nav.commands", icon: "console" },
  mcp: { color: "text-purple-500", back: "/store/mcp-servers", label: "store.sidebar.nav.mcpServers", icon: "server" },
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${(ms / 60_000).toFixed(1)} min`
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

function installCmd(item: CapabilityItem) {
  const owner =
    item.registry?.orgId && item.registry.orgId !== "public" ? item.registry.orgId : item.createdBy || "public"
  return `npx costrict install ${owner}/${item.slug}`
}

function renderMd(content: string) {
  return content.split("\n").map((line) => {
    if (line.startsWith("# ")) return <h1 class="text-2xl font-semibold mt-6 mb-3 text-text-strong">{line.slice(2)}</h1>
    if (line.startsWith("## ")) return <h2 class="text-xl font-medium mt-5 mb-2 text-text-strong">{line.slice(3)}</h2>
    if (line.startsWith("### "))
      return <h3 class="text-base font-medium mt-4 mb-2 text-text-strong">{line.slice(4)}</h3>
    if (line.startsWith("- ")) return <li class="ml-5 list-disc mb-1 text-text-weak">{line.slice(2)}</li>
    if (/^\d+\. /.test(line))
      return <li class="ml-5 list-decimal mb-1 text-text-weak">{line.replace(/^\d+\. /, "")}</li>
    if (line.startsWith("```")) return <div class="font-mono text-xs bg-bg-muted px-3 py-1 rounded my-1">{line}</div>
    if (line.trim()) return <p class="mb-2 leading-relaxed text-text-weak">{line}</p>
    return <br />
  })
}

function ScanRow(props: { scan: ScanResult }) {
  const [open, setOpen] = createSignal(false)
  const language = useLanguage()

  return (
    <div class="rounded-xl border border-border-weak-base bg-bg-muted">
      <div
        onClick={() => setOpen((v) => !v)}
        class="flex w-full cursor-pointer items-center gap-4 px-5 py-4 transition hover:bg-bg-base/50"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <SecurityBadge status={props.scan.riskLevel as any} size="sm" />
            <VerdictBadge verdict={props.scan.verdict as Verdict} size="sm" />
          </div>
          <p class="text-sm text-text-strong">{props.scan.summary || "No summary available"}</p>
          <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-weak">
            <span>{formatDate(props.scan.createdAt)}</span>
          </div>
        </div>
        <div class="shrink-0 text-text-weak">
          <Icon
            name="chevron-down"
            size="small"
            class={`transition-transform duration-150 ${open() ? "rotate-0" : "-rotate-90"}`}
          />
        </div>
      </div>
      <Show when={open()}>
        {(() => {
          const perms = Object.entries(props.scan.permissions ?? {})
          return (
            <div class="space-y-4 px-5 pb-4 pt-1 text-sm text-text-weak">
              <div class="grid gap-3 rounded-lg border border-border-weak-base bg-bg-base/50 p-4 sm:grid-cols-2">
                <div>
                  <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-weak/70">
                    {language.t("store.scanResults.model")}
                  </div>
                  <div class="text-text-strong">{props.scan.scanModel}</div>
                </div>
                <div>
                  <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-weak/70">
                    {language.t("store.scanResults.trigger")}
                  </div>
                  <div class="capitalize text-text-strong">{props.scan.triggerType}</div>
                </div>
                <div>
                  <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-weak/70">
                    {language.t("store.scanResults.duration")}
                  </div>
                  <div class="text-text-strong">{formatDuration(props.scan.durationMs)}</div>
                </div>
                <div>
                  <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-text-weak/70">Finished</div>
                  <div class="text-text-strong">{formatDate(props.scan.finishedAt)}</div>
                </div>
              </div>

              <div class="grid gap-3 lg:grid-cols-2">
                <div class="rounded-lg border border-border-weak-base bg-bg-base/50 p-4">
                  <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-weak/70">
                    {language.t("store.security.suggestions")}
                  </div>
                  <Show
                    when={props.scan.recommendations.length > 0}
                    fallback={<div class="text-text-weak">{language.t("store.scanResults.noRecommendations")}</div>}
                  >
                    <ul class="space-y-2">
                      <For each={props.scan.recommendations}>
                        {(item) => (
                          <li class="rounded-md bg-bg-muted px-3 py-2 text-text-strong">{formatValue(item)}</li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>

                <div class="rounded-lg border border-border-weak-base bg-bg-base/50 p-4">
                  <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-weak/70">
                    {language.t("store.security.foundIssues")}
                  </div>
                  <Show
                    when={props.scan.redFlags.length > 0}
                    fallback={<div class="text-text-weak">{language.t("store.scanResults.noRedFlags")}</div>}
                  >
                    <ul class="space-y-2">
                      <For each={props.scan.redFlags}>
                        {(item) => (
                          <li class="rounded-md bg-bg-muted px-3 py-2 text-text-strong">{formatValue(item)}</li>
                        )}
                      </For>
                    </ul>
                  </Show>
                </div>
              </div>

              <Show when={perms.length > 0}>
                <div class="rounded-lg border border-border-weak-base bg-bg-base/50 p-4">
                  <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-weak/70">
                    {language.t("store.security.permissionNeeds")}
                  </div>
                  <dl class="grid gap-2 sm:grid-cols-2">
                    <For each={perms}>
                      {(entry) => (
                        <div class="rounded-md bg-bg-muted px-3 py-2">
                          <dt class="text-xs uppercase tracking-wide text-text-weak/70">{entry[0]}</dt>
                          <dd class="mt-1 text-text-strong">{formatValue(entry[1])}</dd>
                        </div>
                      )}
                    </For>
                  </dl>
                </div>
              </Show>
            </div>
          )
        })()}
      </Show>
    </div>
  )
}

export default function ItemDetail() {
  const language = useLanguage()
  const auth = useAuth()
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item] = createResource(
    () => params.id,
    (id) => itemApi.get(id),
  )
  const [artifacts] = createResource(
    () => params.id,
    (id) => artifactApi.list(id).then((r) => r.artifacts),
  )
  const [scans] = createResource(
    () => params.id,
    (id) => scanApi.list(id).then((r) => r.results),
  )
  const [copied, setCopied] = createSignal(false)

  const meta = () => TYPE_META[item()?.itemType ?? "skill"] ?? TYPE_META.skill

  const copy = async () => {
    if (!item()) return
    await navigator.clipboard.writeText(installCmd(item()!))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Show
      when={!item.loading}
      fallback={<div class="flex justify-center py-16 text-text-weak">{language.t("store.loading")}</div>}
    >
      <Show
        when={item()}
        fallback={
          <div class="flex flex-col items-center justify-center py-16 gap-4">
            <p class="text-text-weak">{language.t("store.detail.notFound")}</p>
            <button onClick={() => navigate(-1)} class="text-sm text-text-weak hover:text-text-strong">
              {language.t("store.detail.back")}
            </button>
          </div>
        }
      >
        {(data) => (
          <div class="px-8 py-10 w-full max-w-4xl mx-auto">
            <button
              onClick={() => navigate(meta().back)}
              class="inline-flex items-center gap-2 text-sm text-text-weak cursor-pointer hover:text-text-strong hover:-translate-x-px transition-all duration-150 mb-8"
            >
              {language.t("store.detail.backTo", { type: language.t(meta().label) })}
            </button>

            <div class="mb-8">
              <div class="flex items-start justify-between gap-4 mb-4">
                <div class="flex items-center gap-3">
                  <span class={`text-2xl ${meta().color}`}>
                    <Icon name={meta().icon} />
                  </span>
                  <h1 class="text-2xl font-semibold text-text-strong">{data().name}</h1>
                </div>
                <button
                  onClick={copy}
                  class="p-2 rounded text-text-weak cursor-pointer hover:text-text-strong hover:bg-bg-muted hover:shadow-xs-border-base transition-all duration-150"
                  title={language.t("store.itemCard.copyInstall")}
                >
                  {copied() ? "✓" : "⎘"}
                </button>
              </div>
              <div class="flex flex-wrap items-center gap-2 mb-4">
                <span class="px-2 py-0.5 text-xs rounded bg-bg-muted text-text-weak">
                  {language.t("store.capability.type." + (item()?.itemType ?? "skill"))}
                </span>
                <Show when={data().version}>
                  <span class="px-2 py-0.5 text-xs rounded border border-border-weak-base text-text-weak">
                    v{data().version}
                  </span>
                </Show>
                <Show when={data().category}>
                  <span class="px-2 py-0.5 text-xs rounded border border-border-weak-base text-text-weak">
                    #{language.t(categoryKey(data().category))}
                  </span>
                </Show>
                <SecurityBadge status={data().securityStatus} size="sm" />
              </div>
              <Show when={data().description}>
                <p class="text-text-weak">{data().description}</p>
              </Show>
            </div>

            <div class="mb-10 p-4 bg-bg-muted rounded-lg border border-border-weak-base flex items-center justify-between gap-3">
              <div>
                <p class="text-xs text-text-weak mb-1 font-medium">{language.t("store.detail.quickInstall")}</p>
                <code class="text-sm font-mono text-text-strong">{installCmd(data())}</code>
              </div>
              <button
                onClick={copy}
                class="p-2 rounded text-text-weak cursor-pointer hover:text-text-strong hover:bg-bg-base hover:shadow-xs-border-base transition-all duration-150 shrink-0"
              >
                {copied() ? "✓" : "⎘"}
              </button>
            </div>

            <div class="space-y-10">
              <Show when={data().content}>
                <section>
                  <h2 class="text-sm font-semibold text-text-weak uppercase tracking-wide mb-4">
                    {language.t("store.capabilityDialog.field.content")}
                  </h2>
                  <div class="bg-bg-muted rounded-xl p-6 border border-border-weak-base text-sm leading-relaxed">
                    {renderMd(data().content)}
                  </div>
                </section>
              </Show>

              <Show when={(artifacts() ?? []).length > 0}>
                <section>
                  <h2 class="text-sm font-semibold text-text-weak uppercase tracking-wide mb-4">
                    {language.t("store.detail.artifacts")}
                  </h2>
                  <div class="space-y-3">
                    <For each={artifacts() ?? []}>
                      {(artifact) => (
                        <div class="flex items-center justify-between gap-4 p-4 rounded-xl border border-border-weak-base bg-bg-muted hover:border-border-weak-base/80 hover:shadow-xs-border-base transition-all duration-150">
                          <div class="min-w-0">
                            <div class="font-medium truncate text-text-strong">{artifact.filename}</div>
                            <div class="text-sm text-text-weak">
                              v{artifact.version} · {formatBytes(artifact.fileSize)} · {artifact.downloadCount}{" "}
                              {language.t("store.detail.downloads")}
                              <Show when={artifact.isLatest}>
                                <span class="ml-2 px-1.5 py-0.5 text-xs bg-bg-base rounded">
                                  {language.t("store.detail.latest")}
                                </span>
                              </Show>
                            </div>
                          </div>
                          <a
                            href={artifactApi.downloadUrl(artifact.id)}
                            download=""
                            class="px-3 py-1.5 text-sm bg-bg-base border border-border-weak-base rounded text-text-strong cursor-pointer hover:bg-bg-muted hover:shadow-xs-border-base transition-all duration-150"
                          >
                            {language.t("store.itemCard.download")}
                          </a>
                        </div>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              <section>
                <h2 class="text-sm font-semibold text-text-weak uppercase tracking-wide mb-4">
                  {language.t("store.detail.details")}
                </h2>
                <div class="bg-bg-muted rounded-xl border border-border-weak-base overflow-hidden">
                  <dl class="divide-y divide-border-weak-base">
                    <div class="flex items-center justify-between px-5 py-3.5">
                      <dt class="text-text-weak">{language.t("store.console.capabilities.type")}</dt>
                      <dd class="font-medium text-text-strong">
                        {language.t("store.capability.type." + (data().itemType ?? "skill"))}
                      </dd>
                    </div>
                    <div class="flex items-center justify-between px-5 py-3.5">
                      <dt class="text-text-weak">{language.t("store.console.capabilities.visibility")}</dt>
                      <dd class="capitalize text-text-strong">{data().visibility}</dd>
                    </div>
                    <Show when={data().createdByName}>
                      <div class="flex items-center justify-between px-5 py-3.5">
                        <dt class="text-text-weak">{language.t("store.detail.author")}</dt>
                        <dd class="font-medium text-text-strong">{data().createdByName || '-'}</dd>
                      </div>
                    </Show>
                    <div class="flex items-center justify-between px-5 py-3.5">
                      <dt class="text-text-weak">{language.t("store.detail.created")}</dt>
                      <dd class="text-text-strong">{formatDate(data().createdAt)}</dd>
                    </div>
                    <div class="flex items-center justify-between px-5 py-3.5">
                      <dt class="text-text-weak">{language.t("store.detail.updated")}</dt>
                      <dd class="text-text-strong">{formatDate(data().updatedAt)}</dd>
                    </div>
                  </dl>
                </div>
              </section>

              <Show when={(scans() ?? []).length > 0}>
                <section>
                  <h2 class="text-sm font-semibold uppercase tracking-wide text-text-weak mb-4">
                    {language.t("store.scanResults.securityScan")}
                  </h2>
                  <div class="space-y-3">
                    <For each={scans() ?? []}>{(scan) => <ScanRow scan={scan} />}</For>
                  </div>
                </section>
              </Show>
            </div>
          </div>
        )}
      </Show>
    </Show>
  )
}
