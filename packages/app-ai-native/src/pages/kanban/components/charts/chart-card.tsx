import { createEffect, onCleanup, onMount, untrack } from "solid-js"
import * as echarts from "echarts"
import type { EChartsOption } from "echarts"
import { useLanguage } from "@/context/language"
import { useTheme } from "@opencode-ai/ui/theme"

type Props = {
  option?: EChartsOption
  height?: string
  empty?: string
}

function isDarkScheme(scheme: string): boolean {
  if (scheme === "dark") return true
  if (scheme === "light") return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function ChartCard(props: Props) {
  let el: HTMLDivElement | undefined
  let chart: echarts.ECharts | undefined
  const language = useLanguage()
  const theme = useTheme()

  onMount(() => {
    const resize = () => chart?.resize()
    let obs: ResizeObserver | undefined
    if (typeof ResizeObserver === "function") {
      obs = new ResizeObserver(resize)
      if (el) obs.observe(el)
    } else {
      window.addEventListener("resize", resize)
    }

    onCleanup(() => {
      if (obs) obs.disconnect()
      else window.removeEventListener("resize", resize)
      chart?.dispose()
    })
  })

  createEffect(() => {
    if (!el) return
    const dark = isDarkScheme(theme.colorScheme())
    chart?.dispose()
    chart = echarts.init(el, dark ? "dark" : undefined)
    const next = untrack(() => props.option)
    if (next) chart.setOption(next, true)
  })

  createEffect(() => {
    if (!chart) return
    const next = props.option
    if (!next) {
      chart.clear()
      return
    }
    chart.setOption(next, true)
  })

  return (
    <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-3 shadow-[var(--native-shadow-sm)]">
      <div ref={el} class="w-full" style={{ height: props.height ?? "280px" }}>
        {!props.option ? <div class="flex h-full items-center justify-center text-sm text-[var(--native-muted)]">{props.empty ?? language.t("kanban.chart.empty.data")}</div> : null}
      </div>
    </section>
  )
}

export default ChartCard