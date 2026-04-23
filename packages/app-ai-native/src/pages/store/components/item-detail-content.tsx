import { createResource, createSignal, createEffect, Show, For } from "solid-js"
import { createHighlighter } from "shiki"
import { useTheme } from "@opencode-ai/ui/theme"
import { Icon } from "@opencode-ai/ui/icon"
import { Markdown } from "@opencode-ai/ui/markdown"
import { LocalIcon } from "@/components/local-icon"
import AvatarDisplay from "@/components/avatar-display"
import { artifactApi, itemApi, scanApi, userApi, type CapabilityItem, type ScanResult } from "../lib/api"
import { useLanguage } from "@/context/language"
import { categoryKey, formatBytes } from "../lib/constants"
import SecurityTag, { VerdictTag, type Verdict } from "./security-tag"

const TYPE_META: Record<string, { accent: string; bg: string; label: string; icon: "sparkles" | "brain" | "console" | "mcp" }> = {
  skill: { accent: "#ffa000", bg: "#FEF3C7", label: "store.sidebar.nav.skills", icon: "sparkles" },
  subagent: { accent: "#1670ff", bg: "#DBEAFE", label: "store.sidebar.nav.subagents", icon: "brain" },
  command: { accent: "#09b179", bg: "#D1FAE5", label: "store.sidebar.nav.commands", icon: "console" },
  mcp: { accent: "#7338f9", bg: "#EDE9FE", label: "store.sidebar.nav.mcpServers", icon: "mcp" },
}

const THEMES = { light: "github-light", dark: "github-dark" } as const

const TAG_COLOR_BY_CLASS = {
  system: {
    color: "#e17a0c",
    background: "#f9a02c1a",
  },
  custom: {
    color: "#478be6",
    background: "#4184e41a",
  },
} as const

let highlighter: Awaited<ReturnType<typeof createHighlighter>> | undefined

export function getInstallCommand(item: CapabilityItem) {
  const registry = item.registry?.name || "public"
  return `cs plugin add ${item.itemType} ${registry}/${item.slug}`
}

function formatDate(iso: string, locale?: string) {
  const normalizedLocale = locale?.startsWith("zh") ? "zh-CN" : "en-US"
  return new Intl.DateTimeFormat(normalizedLocale, {
    year: "numeric",
    month: normalizedLocale === "zh-CN" ? "long" : "short",
    day: "numeric",
  }).format(new Date(iso))
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

function formatCompactCount(value: number) {
  if (value >= 1000000) {
    const next = (value / 1000000).toFixed(value >= 10000000 ? 0 : 1)
    return `${next.replace(/\.0$/, "")}M`
  }
  if (value >= 1000) {
    const next = (value / 1000).toFixed(value >= 10000 ? 0 : 1)
    return `${next.replace(/\.0$/, "")}k`
  }
  return String(value)
}

function compareTags(a: { tagClass?: string; slug: string }, b: { tagClass?: string; slug: string }) {
  const aPriority = a.tagClass === "system" ? 0 : 1
  const bPriority = b.tagClass === "system" ? 0 : 1
  if (aPriority !== bPriority) return aPriority - bPriority
  return a.slug.localeCompare(b.slug, undefined, { sensitivity: "base" })
}

function tagStyle(tagClass?: string) {
  const accent = tagClass === "system" ? TAG_COLOR_BY_CLASS.system : TAG_COLOR_BY_CLASS.custom
  return {
    color: accent.color,
    "background-color": accent.background,
  }
}

function VisibilityIcon(props: { visibility?: string }) {
  return (
    <span class="inline-flex items-center text-text-weak" aria-hidden="true">
      <Show
        when={props.visibility === "private"}
        fallback={(
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-4">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18" />
            <path d="M12 3a15 15 0 0 1 0 18" />
            <path d="M12 3a15 15 0 0 0 0 18" />
          </svg>
        )}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="size-4">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 1 1 8 0v3" />
        </svg>
      </Show>
    </span>
  )
}

function tryJson(raw: string): string | null {
  try {
    const unescaped = raw.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\r/g, "\r")
    const cleaned = unescaped.replace(/,\s*([\]\}])/g, "$1")
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === "object" && parsed !== null) return JSON.stringify(parsed, null, 2)
    return null
  } catch {
    return null
  }
}

async function highlight(json: string, mode: "light" | "dark") {
  if (!highlighter) highlighter = await createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: ["json"] })
  return highlighter.codeToHtml(json, { lang: "json", theme: THEMES[mode] })
}

function ScanRow(props: { scan: ScanResult }) {
  const [open, setOpen] = createSignal(false)
  const language = useLanguage()

  return (
    <div class="overflow-hidden rounded-lg border border-border-weak-base">
      <div
        onClick={() => setOpen((value) => !value)}
        class="flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-bg-muted/50"
      >
        <div class="min-w-0 flex-1">
          <div class="mb-0.5 flex items-center gap-2">
            <SecurityTag status={props.scan.riskLevel as never} />
            <VerdictTag verdict={props.scan.verdict as Verdict} />
          </div>
          <p class="break-words text-12-regular text-text-strong">{props.scan.summary || "No summary available"}</p>
          <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-weak">
            <span>{formatDate(props.scan.createdAt, language.locale())}</span>
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
            <div class="space-y-2.5 px-3 pb-3 pt-1 text-12-regular text-text-weak">
              <div class="grid gap-2.5 rounded-lg bg-bg-muted p-2.5 sm:grid-cols-2">
                <div>
                  <div class="mb-0.5 text-xs text-text-weak/70">{language.t("store.scanResults.model")}</div>
                  <div class="text-text-strong">{props.scan.scanModel}</div>
                </div>
                <div>
                  <div class="mb-0.5 text-xs text-text-weak/70">{language.t("store.scanResults.trigger")}</div>
                  <div class="capitalize text-text-strong">{props.scan.triggerType}</div>
                </div>
                <div>
                  <div class="mb-0.5 text-xs text-text-weak/70">{language.t("store.scanResults.duration")}</div>
                  <div class="text-text-strong">{formatDuration(props.scan.durationMs)}</div>
                </div>
                <div>
                  <div class="mb-0.5 text-xs text-text-weak/70">Finished</div>
                  <div class="text-text-strong">{formatDate(props.scan.finishedAt, language.locale())}</div>
                </div>
              </div>

              <div class="grid gap-2.5 lg:grid-cols-2">
                <div class="rounded-lg bg-bg-muted p-2.5">
                  <div class="mb-1 text-xs text-text-weak/70">{language.t("store.security.suggestions")}</div>
                  <Show
                    when={props.scan.recommendations.length > 0}
                    fallback={<div class="text-text-weak">{language.t("store.scanResults.noRecommendations")}</div>}
                  >
                    <ul class="space-y-1">
                      <For each={props.scan.recommendations}>
                        {(item) => <li class="break-words text-text-strong">{formatValue(item)}</li>}
                      </For>
                    </ul>
                  </Show>
                </div>

                <div class="rounded-lg bg-bg-muted p-2.5">
                  <div class="mb-1 text-xs text-text-weak/70">{language.t("store.security.foundIssues")}</div>
                  <Show
                    when={props.scan.redFlags.length > 0}
                    fallback={<div class="text-text-weak">{language.t("store.scanResults.noRedFlags")}</div>}
                  >
                    <ul class="space-y-1">
                      <For each={props.scan.redFlags}>
                        {(item) => <li class="break-words text-text-strong">{formatValue(item)}</li>}
                      </For>
                    </ul>
                  </Show>
                </div>
              </div>

              <Show when={perms.length > 0}>
                <div class="rounded-lg bg-bg-muted p-2.5">
                  <div class="mb-1 text-xs text-text-weak/70">{language.t("store.security.permissionNeeds")}</div>
                  <dl class="grid gap-2 sm:grid-cols-2">
                    <For each={perms}>
                      {(entry) => (
                        <div>
                          <dt class="text-xs text-text-weak/70">{entry[0]}</dt>
                          <dd class="mt-0.5 break-words text-text-strong">{formatValue(entry[1])}</dd>
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

interface ItemDetailContentProps {
  itemId: string
  class?: string
  showBackButton?: boolean
  onBack?: () => void
  onItemLoaded?: (item: CapabilityItem) => void
  favorited?: boolean
  favoriteCount?: number
  previewCount?: number
  installCount?: number
  onToggleFavorite?: () => Promise<void>
  favoritePending?: boolean
  isAuthenticated?: boolean
}

export default function ItemDetailContent(props: ItemDetailContentProps) {
  const language = useLanguage()
  const theme = useTheme()
  const [item] = createResource(
    () => props.itemId,
    (id) => itemApi.get(id),
  )

  createEffect(() => {
    const data = item()
    if (data) props.onItemLoaded?.(data)
  })
  const [artifacts] = createResource(
    () => props.itemId,
    (id) => artifactApi.list(id).then((result) => result.artifacts),
  )
  const [scans] = createResource(
    () => props.itemId,
    (id) => scanApi.list(id).then((result) => result.results),
  )
  const [authorName] = createResource(
    () => item()?.createdBy,
    (createdBy) => userApi.getNames([createdBy]).then((names) => names[createdBy] ?? createdBy),
  )
  const [authorInfo] = createResource(
    () => item()?.createdBy,
    async (createdBy) => {
      if (!createdBy) return null
      const info = await userApi.getInfo([createdBy]).catch(() => ({}))
      return info[createdBy] ?? null
    },
  )
  const [copied, setCopied] = createSignal(false)
  const [highlighted] = createResource(
    () => {
      const json = tryJson(item()?.content ?? "")
      if (!json) return null
      return { json, mode: theme.mode() === "light" ? "light" : "dark" } as const
    },
    (source) => highlight(source.json, source.mode),
  )

  const meta = () => TYPE_META[item()?.itemType ?? "skill"] ?? TYPE_META.skill

  const copy = async () => {
    if (!item()) return
    await navigator.clipboard.writeText(getInstallCommand(item()!))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Show when={!item.loading} fallback={<div class="flex justify-center py-16 text-text-weak">{language.t("store.loading")}</div>}>
      <Show
        when={item()}
        fallback={
          <div class="flex flex-col items-center justify-center gap-4 py-16">
            <p class="text-text-weak">{language.t("store.detail.notFound")}</p>
            <Show when={props.onBack && props.showBackButton}>
              <button onClick={props.onBack} class="text-12-regular text-text-weak transition-colors hover:text-text-strong">
                {language.t("store.detail.back")}
              </button>
            </Show>
          </div>
        }
      >
        {(data) => (
          <div class={`detail-panel flex h-full flex-col ${props.class ?? ""}`.trim()}>
            <div class="detail-panel-header border-b border-border-weak-base px-6 pb-5 pr-14 pt-6">
              <Show when={props.onBack && props.showBackButton}>
                <button
                  onClick={props.onBack}
                  class="mb-3 inline-flex cursor-pointer items-center gap-1 text-12-regular text-text-weak transition-colors duration-150 hover:text-text-strong"
                >
                  <Icon name="chevron-left" size="small" />
                  {language.t("store.detail.back")}
                </button>
              </Show>

              <div class="flex items-start justify-between gap-6">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-3">
                    <div
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--native-radius-md)]"
                      style={{ "background-color": meta().bg, color: meta().accent }}
                    >
                      <Icon name={meta().icon} />
                    </div>
                    <h1
                      class="min-w-0 text-text-strong"
                      style={{ "font-size": "24px", "letter-spacing": "-0.02em", "line-height": "1.25" }}
                    >
                      {data().name}
                    </h1>
                  </div>
                  <Show when={data().description}>
                    <p class="mt-3 max-w-[64rem] text-[13px] leading-6 text-text-weak">{data().description}</p>
                  </Show>
                </div>
                <div class="flex shrink-0 items-center gap-1.5 self-start">
                  <Show when={data().sourceType === "archive"}>
                    <span
                      class="mt-0.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs"
                      style={{ "background-color": "rgba(59,130,246,0.12)", color: "rgb(59,130,246)" }}
                      title={language.t("store.sourceType.archive")}
                    >
                      <Icon name="cloud-upload" size="small" />
                    </span>
                  </Show>
                  <Show when={props.onToggleFavorite}>
                    <button
                      onClick={() => void props.onToggleFavorite?.()}
                      disabled={!props.isAuthenticated || props.favoritePending}
                      class="inline-flex items-center gap-1.5 rounded-lg border border-border-weak-base px-3 py-1.5 text-12-regular transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60"
                      classList={{
                        "bg-bg-muted text-text-strong hover:bg-bg-muted/70": props.favorited,
                        "text-text-weak hover:text-text-strong hover:bg-bg-muted": !props.favorited,
                      }}
                      title={
                        props.isAuthenticated
                          ? props.favorited
                            ? language.t("store.detail.unfavorite")
                            : language.t("store.detail.favorite")
                          : language.t("store.detail.favoriteSignIn")
                      }
                    >
                      <span class="inline-flex items-center" style={{ width: "14px", height: "14px" }}><LocalIcon name={props.favorited ? "star-filled" : "star"} size="small" style={{ color: props.favorited ? (TYPE_META[item()?.itemType ?? ""]?.accent ?? "var(--native-primary)") : undefined, width: "14px", height: "14px" }} /></span>
                      <span>
                        {props.isAuthenticated
                          ? props.favorited
                            ? language.t("store.detail.favorited")
                            : language.t("store.detail.favorite")
                          : language.t("store.detail.favoriteSignIn")}
                      </span>
                    </button>
                  </Show>
                </div>
              </div>
            </div>

            <div class="detail-panel-body flex-1 overflow-auto px-6 py-5">
              <div class="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(14rem,0.6fr)]">
                <div class="min-w-0 space-y-5">
                  <div class="flex items-center gap-2 rounded-lg px-4 py-2.5" style="background-color: var(--native-surface-strong)">
                    <div class="thin-scrollbar flex min-w-0 flex-1 items-center overflow-x-auto">
                      <code class="select-all whitespace-nowrap text-12-mono text-text-weak">{getInstallCommand(data())}</code>
                    </div>
                    <button
                      onClick={copy}
                      class="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-weak transition-all duration-150 hover:bg-bg-muted hover:text-text-strong"
                      title={language.t("store.itemCard.copyInstall")}
                    >
                      <Icon name={copied() ? "check-small" : "copy"} size="small" class={copied() ? "text-green-500" : ""} />
                    </button>
                  </div>

                  <Show when={data().content}>
                    <div>
                      <Show
                        when={highlighted()}
                        fallback={
                          <div class="thin-scrollbar min-h-[28rem] overflow-y-auto rounded-lg border border-border-weak-base bg-bg-muted/50 px-5 py-4">
                            <Markdown text={data().content} class="text-14-regular" />
                          </div>
                        }
                      >
                        <div
                          class="thin-scrollbar min-h-[28rem] overflow-x-auto overflow-y-auto rounded-lg border border-border-weak-base bg-bg-muted/50 p-4 text-12-mono leading-6 [&_pre]:!m-0 [&_pre]:!bg-transparent [&_pre]:!p-0"
                          innerHTML={highlighted()}
                        />
                      </Show>
                    </div>
                  </Show>

                  <Show when={(artifacts() ?? []).length > 0}>
                    <div>
                      <h2 class="mb-2 text-14-medium text-text-strong">{language.t("store.detail.artifacts")}</h2>
                      <div class="overflow-hidden rounded-lg border border-border-weak-base">
                        <For each={artifacts() ?? []}>
                          {(artifact) => (
                            <div class="flex items-center justify-between gap-3 border-b border-border-weak-base px-3 py-2.5 transition-colors duration-150 last:border-b-0 hover:bg-bg-muted/40">
                              <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                  <span class="truncate text-12-regular text-text-strong">{artifact.filename}</span>
                                  <Show when={artifact.isLatest}>
                                    <span
                                      class="inline-flex items-center rounded-[10px] px-2 py-[1px] text-xs"
                                      style={{
                                        "background-color": `color-mix(in srgb, ${meta().accent} 12%, transparent)`,
                                        color: meta().accent,
                                      }}
                                    >
                                      {language.t("store.detail.latest")}
                                    </span>
                                  </Show>
                                </div>
                                <div class="mt-0.5 text-xs text-text-weak">
                                  {artifact.version ? `v${artifact.version} · ` : ""}
                                  {formatBytes(artifact.fileSize)}
                                </div>
                              </div>
                              <a
                                href={artifactApi.downloadUrl(artifact.id)}
                                download=""
                                class="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-12-regular text-text-weak transition-all duration-150 hover:bg-bg-muted hover:text-text-strong"
                              >
                                <Icon name="download" size="small" />
                                {language.t("store.itemCard.download")}
                              </a>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>

                  <Show when={(scans() ?? []).length > 0}>
                    <div class="pb-4">
                      <h2 class="mb-2 text-14-medium text-text-strong">{language.t("store.scanResults.securityScan")}</h2>
                      <div class="space-y-2">
                        <For each={scans() ?? []}>{(scan) => <ScanRow scan={scan} />}</For>
                      </div>
                    </div>
                  </Show>
                </div>

                <aside class="min-w-0 space-y-5 xl:sticky xl:top-0 xl:self-start">
                  <div class="p-1">
                    <div class="space-y-3">
                      <div>
                        <div class="flex items-center gap-4 text-sm leading-5 text-text-strong">
                          <span class="inline-flex items-center gap-1.5" title={language.t("store.capability.type." + (data().itemType ?? "skill"))}>
                            <div
                              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.375rem]"
                              style={{ "background-color": meta().bg, color: meta().accent }}
                            >
                              <Icon name={meta().icon} size="small" />
                            </div>
                            <span>{language.t("store.capability.type." + (data().itemType ?? "skill"))}</span>
                          </span>
                          <span
                            class="inline-flex items-center gap-1.5"
                            title={`${language.t("store.detail.previewCount")}: ${(props.previewCount ?? data().previewCount ?? 0).toLocaleString()}`}
                          >
                            <LocalIcon name="view" size="small" />
                            <span>{formatCompactCount(props.previewCount ?? data().previewCount ?? 0)}</span>
                          </span>
                          <span
                            class="inline-flex items-center gap-1.5"
                            title={`${language.t("store.detail.installCount")}: ${(props.installCount ?? data().installCount ?? 0).toLocaleString()}`}
                          >
                            <LocalIcon name="download" size="small" />
                            <span>{formatCompactCount(props.installCount ?? data().installCount ?? 0)}</span>
                          </span>
                          <span
                            class="inline-flex items-center gap-1.5"
                            title={`${language.t("store.detail.favoriteCount")}: ${(props.favoriteCount ?? data().favoriteCount ?? 0).toLocaleString()}`}
                          >
                            <LocalIcon name="star" size="small" />
                            <span>{formatCompactCount(props.favoriteCount ?? data().favoriteCount ?? 0)}</span>
                          </span>
                        </div>
                      </div>

                      <div>
                        <div class="mb-1 text-xs" style={{ color: "color-mix(in srgb, var(--native-muted) 70%, var(--native-panel))", "font-weight": 700 }}>{language.t("store.console.capabilities.visibility")}</div>
                        <div class="inline-flex items-center gap-1.5 text-sm leading-5 text-text-strong">
                          <VisibilityIcon visibility={data().repoVisibility} />
                          <span>
                            {data().repoVisibility === "public"
                              ? language.t("store.capability.visibility.public")
                              : data().repoVisibility === "private"
                                ? language.t("store.capability.visibility.private")
                                : "-"}
                          </span>
                        </div>
                      </div>

                      <Show when={authorInfo() || authorName()}>
                        <div>
                          <div class="mb-1 text-xs" style={{ color: "color-mix(in srgb, var(--native-muted) 70%, var(--native-panel))", "font-weight": 700 }}>{language.t("store.detail.author")}</div>
                          <div>
                            <AvatarDisplay
                              avatarUrl={authorInfo()?.avatarUrl}
                              username={authorInfo()?.name ?? authorName() ?? data().createdBy}
                              class="size-6 shrink-0"
                              title={authorInfo()?.name ?? authorName() ?? data().createdBy}
                            />
                          </div>
                        </div>
                      </Show>

                      <Show when={data().category}>
                        <div>
                          <div class="mb-1 text-xs" style={{ color: "color-mix(in srgb, var(--native-muted) 70%, var(--native-panel))", "font-weight": 700 }}>{language.t("store.console.capabilities.category")}</div>
                          <div class="text-sm leading-5 text-text-strong">{language.t(categoryKey(data().category))}</div>
                        </div>
                      </Show>

                      <div>
                        <div class="mb-1 text-xs" style={{ color: "color-mix(in srgb, var(--native-muted) 70%, var(--native-panel))", "font-weight": 700 }}>{language.t("store.scanResults.securityScan")}</div>
                        <div>
                          <SecurityTag status={data().securityStatus} />
                        </div>
                      </div>

                      <Show when={(data().tags ?? []).length > 0}>
                        <div>
                        <div class="mb-2 text-xs" style={{ color: "color-mix(in srgb, var(--native-muted) 70%, var(--native-panel))", "font-weight": 700 }}>{language.t("store.home.table.tag")}</div>
                        <div class="flex flex-wrap items-center gap-1.5">
                          <For each={[...(data().tags ?? [])].sort(compareTags)}>
                            {(tag) => (
                              <span
                                class="inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-[11px] leading-4 font-semibold"
                                style={tagStyle(tag.tagClass)}
                                title={tag.slug}
                              >
                                <span class="truncate">{tag.slug}</span>
                              </span>
                            )}
                          </For>
                        </div>
                        </div>
                      </Show>

                      <div class="space-y-3">
                        <div class="flex items-center justify-between gap-4">
                          <div class="text-xs" style={{ color: "color-mix(in srgb, var(--native-muted) 70%, var(--native-panel))", "font-weight": 700 }}>{language.t("store.detail.created")}</div>
                          <div class="text-right text-sm leading-5 text-text-strong">{formatDate(data().createdAt, language.locale())}</div>
                        </div>
                        <div class="flex items-center justify-between gap-4">
                          <div class="text-xs" style={{ color: "color-mix(in srgb, var(--native-muted) 70%, var(--native-panel))", "font-weight": 700 }}>{language.t("store.detail.updated")}</div>
                          <div class="text-right text-sm leading-5 text-text-strong">{formatDate(data().updatedAt, language.locale())}</div>
                        </div>
                      </div>

                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )}
      </Show>
    </Show>
  )
}
