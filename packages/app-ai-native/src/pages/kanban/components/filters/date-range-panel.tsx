import { DatePicker, parseDate, type DateValue } from "@ark-ui/solid/date-picker"
import { ChevronLeft, ChevronRight } from "lucide-solid"
import { createEffect, createMemo, createSignal, For, Index, Show } from "solid-js"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { dateShortcuts, detectShortcut, formatDay, normalizeDateRange, shortcutRange } from "../../lib/date-range"
import type { DateRangeValue } from "../../lib/types"
import "./date-range-calendar.css"

const nav = "inline-flex size-8 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
const view = "inline-flex min-h-8 items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95"
const table = "kb-date-range__table w-full"
const head = "h-8 w-10 text-center text-xs font-medium text-muted-foreground"
const cell = "kb-date-range__cell"
const day = "kb-date-range__day"
const grid = "kb-date-range__grid"

function monthViewLabel(value: { start: { year: number }; end: { year: number } }) {
  return value.start.year === value.end.year ? String(value.start.year) : `${value.start.year} - ${value.end.year}`
}

function yearViewLabel(value: { start?: number; end?: number }) {
  if (value.start == null || value.end == null) return "Select year"
  return `${value.start} - ${value.end}`
}

function later(fn: () => void) {
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => fn())
    return
  }

  setTimeout(fn, 0)
}

type Props = {
  value?: DateRangeValue
  onChange: (value: DateRangeValue) => void
  onClose?: () => void
  clearable?: boolean
  placeholder?: string
}

function monthLabel(value: { year: number; month: number }) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(value.year, value.month - 1, 1)))
}

export function DateRangePanel(props: Props) {
  const [start, setStart] = createSignal("")
  const [end, setEnd] = createSignal("")
  const [pick, setPick] = createSignal<DateValue[]>([])
  const active = createMemo(() => detectShortcut([start(), end()]))

  createEffect(() => {
    const next = normalizeDateRange(props.value)
    setStart(next?.[0] ?? "")
    setEnd(next?.[1] ?? "")
    setPick(next ? next.map((item) => parseDate(item)) : [])
  })

  const commit = (value: DateRangeValue) => {
    props.onClose?.()
    later(() => props.onChange(value))
  }

  const sync = (next: DateValue[]) => {
    const list = next.filter(Boolean)
    setPick(list)
    setStart(list[0]?.toString() ?? "")
    setEnd(list[1]?.toString() ?? "")

    const range = normalizeDateRange(list.map((item) => item.toString()) as DateRangeValue)
    if (range) commit(range)
  }

  const clear = () => {
    setStart("")
    setEnd("")
    setPick([])
    props.onClose?.()
    later(() => props.onChange(null))
  }

  return (
    <div class="flex w-[min(760px,calc(100vw-2rem))] flex-col overflow-hidden">
      <div class="flex flex-col md:flex-row">
        <div class="flex flex-wrap content-start gap-2 border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] p-3 md:w-[120px] md:flex-none md:flex-col md:flex-nowrap md:border-r md:border-b-0">
          <For each={dateShortcuts}>
            {(item) => (
              <button
                type="button"
                class={cn(
                  "inline-flex h-8 w-[120px] items-center rounded-[var(--native-radius-sm)] px-3 text-left text-[13px] leading-none whitespace-nowrap transition-colors",
                  active() === item.label
                    ? "bg-[var(--native-primary)] text-[var(--native-primary-foreground)]"
                    : "bg-[color:color-mix(in_oklab,var(--native-surface)_78%,var(--native-panel))] text-[var(--native-muted)] hover:bg-[var(--native-primary-soft)] hover:text-[var(--native-primary)]",
                )}
                onClick={() => {
                  const next = shortcutRange(item.days)
                  setPick(next.map((item) => parseDate(item)))
                  setStart(next[0])
                  setEnd(next[1])
                  props.onClose?.()
                  later(() => props.onChange(next))
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>

        <div class="min-w-0 flex-1 bg-[color:color-mix(in_oklab,var(--native-panel)_86%,var(--native-bg-subtle))] p-3 md:p-4">
          <DatePicker.Root
            inline
            open
            closeOnSelect={false}
            selectionMode="range"
            numOfMonths={2}
            startOfWeek={1}
            class="flex flex-col gap-3"
            value={pick()}
            onValueChange={(details) => sync(details.value)}
            format={(item) => formatDay(item.toDate("UTC"))}
          >
            <div class="border-0 bg-transparent p-0 shadow-none">
              <DatePicker.View view="day" class="kb-date-range__view flex flex-col gap-4">
                <DatePicker.Context>
                  {(api) => {
                    const offset = createMemo(() => api().getOffset({ months: 1 }))

                    return (
                      <>
                        <DatePicker.ViewControl class="flex items-center justify-between gap-2">
                          <DatePicker.PrevTrigger class={nav}><ChevronLeft class="size-4" /></DatePicker.PrevTrigger>
                          <DatePicker.ViewTrigger class={view}>
                            <DatePicker.RangeText class="text-sm font-medium text-foreground" />
                          </DatePicker.ViewTrigger>
                          <DatePicker.NextTrigger class={nav}><ChevronRight class="size-4" /></DatePicker.NextTrigger>
                        </DatePicker.ViewControl>

                        <div class="flex flex-wrap gap-3">
                          <div class="min-w-[18rem] flex-1 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_26%,transparent)] bg-[var(--native-panel)] p-3 shadow-[var(--native-shadow-sm)]">
                            <div class="mb-2 text-center text-[0.75rem] font-semibold tracking-[0.04em] text-[var(--native-muted)]">
                              {monthLabel(api().visibleRange.start)}
                            </div>
                            <DatePicker.Table class={cn(table, "mx-auto")}>
                              <DatePicker.TableHead>
                                <DatePicker.TableRow>
                                  <Index each={api().weekDays}>
                                    {(item) => <DatePicker.TableHeader class={head}>{item().short}</DatePicker.TableHeader>}
                                  </Index>
                                </DatePicker.TableRow>
                              </DatePicker.TableHead>
                              <DatePicker.TableBody>
                                <Index each={api().weeks}>
                                  {(week) => (
                                    <DatePicker.TableRow>
                                      <Index each={week()}>
                                        {(item) => (
                                          <DatePicker.TableCell class={cell} value={item()}>
                                            <DatePicker.TableCellTrigger class={day}>{item().day}</DatePicker.TableCellTrigger>
                                          </DatePicker.TableCell>
                                        )}
                                      </Index>
                                    </DatePicker.TableRow>
                                  )}
                                </Index>
                              </DatePicker.TableBody>
                            </DatePicker.Table>
                          </div>

                          <div class="min-w-[18rem] flex-1 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_26%,transparent)] bg-[var(--native-panel)] p-3 shadow-[var(--native-shadow-sm)]">
                            <div class="mb-2 text-center text-[0.75rem] font-semibold tracking-[0.04em] text-[var(--native-muted)]">
                              {monthLabel(offset().visibleRange.start)}
                            </div>
                            <DatePicker.Table class={cn(table, "mx-auto")}>
                              <DatePicker.TableHead>
                                <DatePicker.TableRow>
                                  <Index each={api().weekDays}>
                                    {(item) => <DatePicker.TableHeader class={head}>{item().short}</DatePicker.TableHeader>}
                                  </Index>
                                </DatePicker.TableRow>
                              </DatePicker.TableHead>
                              <DatePicker.TableBody>
                                <Index each={offset().weeks}>
                                  {(week) => (
                                    <DatePicker.TableRow>
                                      <Index each={week()}>
                                        {(item) => (
                                          <DatePicker.TableCell class={cell} value={item()} visibleRange={offset().visibleRange}>
                                            <DatePicker.TableCellTrigger class={day}>{item().day}</DatePicker.TableCellTrigger>
                                          </DatePicker.TableCell>
                                        )}
                                      </Index>
                                    </DatePicker.TableRow>
                                  )}
                                </Index>
                              </DatePicker.TableBody>
                            </DatePicker.Table>
                          </div>
                        </div>
                      </>
                    )
                  }}
                </DatePicker.Context>
              </DatePicker.View>

              <DatePicker.View view="month" class="kb-date-range__view flex flex-col gap-4">
                <DatePicker.Context>
                  {(api) => (
                    <>
                      <DatePicker.ViewControl class="flex items-center justify-between gap-2">
                        <DatePicker.PrevTrigger class={nav}><ChevronLeft class="size-4" /></DatePicker.PrevTrigger>
                        <DatePicker.ViewTrigger class={view}>{monthViewLabel(api().visibleRange)}</DatePicker.ViewTrigger>
                        <DatePicker.NextTrigger class={nav}><ChevronRight class="size-4" /></DatePicker.NextTrigger>
                      </DatePicker.ViewControl>

                      <DatePicker.Table class={cn(table, "mx-auto")}>
                        <DatePicker.TableBody>
                          <For each={api().getMonthsGrid({ columns: 4, format: "short" })}>
                            {(row) => (
                              <DatePicker.TableRow>
                                <For each={row}>
                                  {(item) => (
                                    <DatePicker.TableCell class={cell} value={item.value}>
                                      <DatePicker.TableCellTrigger class={grid}>{item.label}</DatePicker.TableCellTrigger>
                                    </DatePicker.TableCell>
                                  )}
                                </For>
                              </DatePicker.TableRow>
                            )}
                          </For>
                        </DatePicker.TableBody>
                      </DatePicker.Table>
                    </>
                  )}
                </DatePicker.Context>
              </DatePicker.View>

              <DatePicker.View view="year" class="kb-date-range__view flex flex-col gap-4">
                <DatePicker.Context>
                  {(api) => (
                    <>
                      <DatePicker.ViewControl class="flex items-center justify-between gap-2">
                        <DatePicker.PrevTrigger class={nav}><ChevronLeft class="size-4" /></DatePicker.PrevTrigger>
                        <DatePicker.ViewTrigger class={view}>{yearViewLabel(api().getDecade())}</DatePicker.ViewTrigger>
                        <DatePicker.NextTrigger class={nav}><ChevronRight class="size-4" /></DatePicker.NextTrigger>
                      </DatePicker.ViewControl>

                      <DatePicker.Table class={cn(table, "mx-auto")}>
                        <DatePicker.TableBody>
                          <For each={api().getYearsGrid({ columns: 4 })}>
                            {(row) => (
                              <DatePicker.TableRow>
                                <For each={row}>
                                  {(item) => (
                                    <DatePicker.TableCell class={cell} value={item.value}>
                                      <DatePicker.TableCellTrigger class={grid}>{item.label}</DatePicker.TableCellTrigger>
                                    </DatePicker.TableCell>
                                  )}
                                </For>
                              </DatePicker.TableRow>
                            )}
                          </For>
                        </DatePicker.TableBody>
                      </DatePicker.Table>
                    </>
                  )}
                </DatePicker.Context>
              </DatePicker.View>
            </div>
          </DatePicker.Root>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 border-t border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3">
          <Show when={props.clearable}>
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear
            </Button>
          </Show>
          <Button variant="outline" size="sm" onClick={() => props.onClose?.()}>
            Close
          </Button>
      </div>
    </div>
  )
}

export default DateRangePanel