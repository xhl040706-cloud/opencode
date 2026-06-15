import { createSignal, onCleanup, Show, type JSX } from "solid-js"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatCompact } from "./store-capability-table"
import { StoreIcon } from "../lib/store-icons"
import type { CapabilityItem } from "../lib/api"

export interface SubscribeButtonProps {
  item: CapabilityItem
  favorited: boolean
  favoriteCount: number
  /** True while the parent has an in-flight favorite toggle for this item (favoriteActionItemId === item.id). */
  pending?: boolean
  authenticated: boolean
  /** True when subscribing is blocked (parent passes mcpListSubscribeBlocked(item)). */
  disabled?: boolean
  onToggle: (item: CapabilityItem) => void
  labels: { subscribe: string; subscribed: string; tooltip: string }
}

/**
 * Single-button subscribe control (订阅即分发). A pill with a bell icon, a label
 * (订阅 / 已订阅) and a compact count. Clicking fires `onToggle(item)` and triggers a
 * one-shot bell ring + a ping halo. The animation classes (`animate-bell-once`,
 * `animate-store-ping`) live in native-theme.css; we add them on click and strip them on
 * `animationend` so they can re-fire on the next click.
 */
export function SubscribeButton(props: SubscribeButtonProps): JSX.Element {
  // Transient animation state: re-armable by toggling the class off after each run.
  const [animating, setAnimating] = createSignal(false)
  let animationTimer: ReturnType<typeof setTimeout> | undefined
  let buttonRef: HTMLButtonElement | undefined

  onCleanup(() => clearTimeout(animationTimer))

  // The control is interactive only when authenticated, not blocked, and not mid-flight.
  const interactive = () => props.authenticated && !props.disabled && !props.pending

  // Replay the bell ring + ping halo on every click, even mid-flight. Strip the classes (and
  // unmount the ping node) → force a synchronous reflow so the browser flushes the removed
  // animation → re-add on the next frame so both keyframes restart from 0% together.
  const triggerAnimation = () => {
    setAnimating(false)
    clearTimeout(animationTimer)
    // Force reflow so the just-removed animation is committed before we re-add it next frame.
    void buttonRef?.offsetWidth
    requestAnimationFrame(() => {
      setAnimating(true)
      // Fallback removal in case animationend doesn't fire (e.g. reduced-motion / display swap).
      animationTimer = setTimeout(() => setAnimating(false), 700)
    })
  }

  const handleClick = (event: MouseEvent) => {
    event.stopPropagation()
    if (!interactive()) return
    triggerAnimation()
    props.onToggle(props.item)
  }

  return (
    <Tooltip value={props.labels.tooltip} placement="top">
      <button
        ref={buttonRef}
        type="button"
        aria-pressed={props.favorited}
        disabled={!interactive()}
        onClick={handleClick}
        class={cn(
          // .sbtn — height 32, pill (radius-full), 1px border, gap 7px, pad 0 13px, 12.5px/800.
          // Spring active scale .94 + 250ms ease transition (设计稿 var(--ease)). The
          // `store-subscribe-btn` hook lets native-theme.css strip these transitions under
          // prefers-reduced-motion (alongside the bell-ring / ping keyframes).
          "store-subscribe-btn relative inline-flex h-8 cursor-pointer items-center gap-[7px] rounded-[var(--native-radius-full)] border px-[13px] text-[12.5px] font-extrabold transition-[background-color,color,border-color,transform] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-[var(--native-disabled-opacity)]",
          props.favorited
            ? // .sbtn.on — primary-tinted bg + primary border + primary text
              "border-[color:color-mix(in_oklab,var(--native-primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--native-primary)_12%,var(--native-panel))] text-[var(--native-primary)]"
            : // .sbtn — glass pill (--pill-bg #ffffff0d / --pill-border #ffffff1f equivalents), hover→fg-weak border
              "border-[color:color-mix(in_oklab,var(--native-foreground)_12%,transparent)] bg-[color:color-mix(in_oklab,var(--native-foreground)_5%,transparent)] text-[var(--native-foreground)] hover:border-[var(--native-dim)]",
        )}
      >
        {/* .ping — concentric ring (left 13, 18×18, 2px primary) that expands & fades on click */}
        <Show when={animating()}>
          <span
            aria-hidden="true"
            class="animate-store-ping pointer-events-none absolute left-[13px] top-1/2 size-[18px] -translate-x-[2px] -translate-y-1/2 rounded-[var(--native-radius-full)] border-2 border-[var(--native-primary)]"
            onAnimationEnd={() => setAnimating(false)}
          />
        </Show>
        {/* .bell — size 14, rings once on click. Two bells are stacked (stroke + filled) and
            cross-faded via opacity so the subscribe ⇄ unsubscribe state change is smooth instead
            of a hard SVG structure swap (stroke→fill flips fill/stroke/stroke-width all at once,
            which flickers). The filled bell fades in (and the stroke fades out) when subscribed.
            The wrapper carries the spring transform transition + one-shot ring keyframe. */}
        <span
          class={cn(
            "relative inline-flex size-[14px] shrink-0 transition-transform duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]",
            animating() && "animate-bell-once",
          )}
        >
          <StoreIcon
            name="bell"
            size={14}
            filled={false}
            class={cn(
              "absolute inset-0 transition-opacity duration-[250ms] ease-out",
              props.favorited ? "opacity-0" : "opacity-100",
            )}
            style={{ color: "currentColor" }}
          />
          <StoreIcon
            name="bell"
            size={14}
            filled={true}
            class={cn(
              "absolute inset-0 transition-opacity duration-[250ms] ease-out",
              props.favorited ? "opacity-100" : "opacity-0",
            )}
            style={{ color: "currentColor" }}
          />
        </span>
        {/* .lab — label cross-fades on state swap and is laid out in a fixed-width slot sized to
            the wider "已订阅" string, so the button doesn't "pop" wider when 订阅(2) → 已订阅(3).
            The two strings are absolutely stacked; a hidden spacer reserves the max width. */}
        <span class="relative inline-flex shrink-0 items-center justify-center whitespace-nowrap">
          {/* invisible spacer = widest label, reserves a stable slot so width never jumps */}
          <span aria-hidden="true" class="invisible">
            {props.labels.subscribed.length >= props.labels.subscribe.length
              ? props.labels.subscribed
              : props.labels.subscribe}
          </span>
          <span
            aria-hidden={props.favorited}
            class={cn(
              "absolute inset-0 inline-flex items-center justify-center transition-opacity duration-[250ms] ease-out",
              props.favorited ? "opacity-0" : "opacity-100",
            )}
          >
            {props.labels.subscribe}
          </span>
          <span
            aria-hidden={!props.favorited}
            class={cn(
              "absolute inset-0 inline-flex items-center justify-center transition-opacity duration-[250ms] ease-out",
              props.favorited ? "opacity-100" : "opacity-0",
            )}
          >
            {props.labels.subscribed}
          </span>
        </span>
        {/* .cnt — tabular-nums (fixed-width digits so the count never reflows the button), weight
            700, muted → primary-tinted when subscribed. Owns its own color transition because the
            explicit text-[...] color overrides the button's inherited color animation. */}
        <span
          class={cn(
            "font-bold [font-variant-numeric:tabular-nums] transition-colors duration-[250ms] ease-out",
            props.favorited
              ? "text-[color:color-mix(in_oklab,var(--native-primary)_80%,var(--native-foreground))]"
              : "text-[var(--native-muted)]",
          )}
        >
          {formatCompact(props.favoriteCount)}
        </span>
      </button>
    </Tooltip>
  )
}

export default SubscribeButton
