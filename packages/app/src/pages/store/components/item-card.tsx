import { createSignal, Show } from "solid-js"
import { A } from "@solidjs/router"
import { useLanguage } from "@/context/language"
import { artifactApi, type CapabilityItem } from "../lib/api"
import { categoryKey } from "../lib/constants"
import SecurityBadge from "./security-badge"

const TYPE_COLOR: Record<string, string> = {
  skill: "text-yellow-500",
  subagent: "text-blue-500",
  command: "text-green-500",
  mcp: "text-purple-500",
}

const TYPE_LABEL: Record<string, string> = {
  skill: "✦",
  subagent: "⬡",
  command: ">_",
  mcp: "⬢",
}

function installCmd(item: CapabilityItem) {
  const owner =
    item.registry?.orgId && item.registry.orgId !== "public" ? item.registry.orgId : item.createdBy || "public"
  return `npx costrict install ${owner}/${item.slug}`
}

export default function ItemCard(props: { item: CapabilityItem }) {
  const [copied, setCopied] = createSignal(false)
  const language = useLanguage()
  const color = () => TYPE_COLOR[props.item.itemType] || "text-text-weak"
  const label = () => TYPE_LABEL[props.item.itemType] || "•"
  const latestArtifact = () => props.item.artifacts?.find((a) => a.isLatest) || props.item.artifacts?.[0]
  const orgName = () =>
    props.item.registry?.orgId && props.item.registry.orgId !== "public" ? props.item.registry.orgId : null

  const handleCopy = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await navigator.clipboard.writeText(installCmd(props.item))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <A
      href={`/store/items/${props.item.id}?type=${props.item.itemType}`}
      class="group flex flex-col px-4 py-3 rounded-md border border-border-weak-base bg-background-base cursor-pointer hover:border-border-weak-base hover:shadow-xs-border-base hover:-translate-y-px active:translate-y-0 transition-all duration-150"
    >
      <div class="flex items-start justify-between gap-2 mb-3">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class={`text-sm shrink-0 ${color()}`}>{label()}</span>
          <span class="font-medium text-sm truncate text-text-strong group-hover:text-text-strong transition-colors">
            {props.item.name}
          </span>
        </div>
        <Show when={props.item.version}>
          <span class="text-xs text-text-weak bg-bg-muted px-1.5 py-0.5 rounded shrink-0">v{props.item.version}</span>
        </Show>
      </div>

      <Show when={props.item.description}>
        <p class="text-xs text-text-weak line-clamp-2 mb-4 flex-1">{props.item.description}</p>
      </Show>

      <div class="flex items-center gap-2 flex-wrap mb-3">
        <Show when={props.item.category}>
          <span class="text-xs text-text-weak">#{language.t(categoryKey(props.item.category))}</span>
        </Show>
        <span class="text-xs text-text-weak">{orgName() ?? "public"}</span>
        <SecurityBadge status={props.item.securityStatus} size="sm" showIcon={false} />
      </div>

      <div class="flex items-center gap-1 mt-auto pt-3 border-t border-border-weak-base">
        <button
          onClick={handleCopy}
          class="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-weak cursor-pointer hover:text-text-strong hover:bg-bg-muted hover:shadow-xs-border-base transition-all duration-150"
          title={language.t("store.itemCard.copyInstall")}
        >
          {copied() ? (
            <span class="text-green-500">{language.t("store.itemCard.copied")}</span>
          ) : (
            <span>{language.t("store.itemCard.copy")}</span>
          )}
        </button>
        <Show when={latestArtifact()}>
          {(artifact) => (
            <a
              href={artifactApi.downloadUrl(artifact().id)}
              download=""
              onClick={(e) => e.stopPropagation()}
              class="flex items-center gap-1 px-2 py-1 rounded text-xs text-text-weak cursor-pointer hover:text-text-strong hover:bg-bg-muted hover:shadow-xs-border-base transition-all duration-150 ml-auto"
              title={language.t("store.itemCard.downloadLatest")}
            >
              {language.t("store.itemCard.download")}
            </a>
          )}
        </Show>
      </div>
    </A>
  )
}
