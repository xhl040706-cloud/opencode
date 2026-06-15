import type { JSX } from "solid-js"
import { cn } from "@/lib/utils"
import type { EnterpriseInfo } from "../lib/enterprise"

const GOLD = "#E5B645"

/**
 * Small inline badge that marks an item as belonging to an enterprise ("大客户"):
 * white-backed logo + enterprise name + gold verified seal. Rendered next to a card/row title.
 *
 * Styled after the design mock's `.entbadge` / `.seal` (gold #E5B645). Uses `--native-*` tokens
 * for the surrounding chrome so it adapts to light/dark themes.
 */
export function EnterpriseBrand(props: { info: EnterpriseInfo; class?: string }): JSX.Element {
  return (
    <span
      class={cn(
        "inline-flex h-[1.375rem] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--native-radius-full)] border py-px pl-[3px] pr-2 text-[11.5px] font-bold text-[var(--native-foreground)]",
        props.class,
      )}
      style={{
        "background-color": "color-mix(in oklab, var(--native-foreground) 4%, transparent)",
        "border-color": `color-mix(in oklab, ${GOLD} 45%, var(--native-border))`,
      }}
      title={props.info.name}
    >
      <img
        src={props.info.logo}
        alt={props.info.name}
        class="size-4 rounded-[4px] bg-[#fff] object-contain"
      />
      <span class="truncate">{props.info.name}</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="12"
        height="12"
        fill="none"
        stroke={GOLD}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="shrink-0"
        aria-hidden="true"
      >
        <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </span>
  )
}
