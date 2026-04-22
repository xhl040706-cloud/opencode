import { createEffect, createMemo, createSignal, For, Index, Show } from "solid-js"
import { Popover } from "@opencode-ai/ui/popover"
import { Button } from "@/components/ui/button"
import {
  DatePicker,
  DatePickerContent,
  DatePickerContext,
  DatePickerControl,
  DatePickerInput,
  DatePickerNextTrigger,
  DatePickerPrevTrigger,
  DatePickerRangeText,
  DatePickerTable,
  DatePickerTableBody,
  DatePickerTableCell,
  DatePickerTableCellTrigger,
  DatePickerTableHead,
  DatePickerTableHeader,
  DatePickerTableRow,
  DatePickerView,
  DatePickerViewControl,
  DatePickerViewTrigger,
  parseDate,
  type DateValue,
} from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"
import { dateShortcuts, detectShortcut, displayDateRange, formatDay, hasRange, normalizeDateRange, shortcutRange } from "../../lib/date-range"
import type { DateRangeValue } from "../../lib/types"

type Props = {
  value?: DateRangeValue
  onChange: (value: DateRangeValue) => void
  clearable?: boolean
  placeholder?: string
  size?: "sm" | "default" | "lg"
  fullWidth?: boolean
}

const sizeClass = {
  sm: "h-8 min-w-[13rem] text-xs",
  default: "h-10 min-w-[15rem] text-sm",
  lg: "h-11 min-w-[16rem] text-sm",
} as const

export function DateRangePicker(props: Props) {
  const [open, setOpen] = createSignal(false)
  const [start, setStart] = createSignal("")
  const [end, setEnd] = createSignal("")
  const [pick, setPick] = createSignal<DateValue[]>([])
  const label = createMemo(() => displayDateRange(props.value, props.placeholder ?? "Select date range"))
  const filled = createMemo(() => hasRange(props.value))
  const active = createMemo(() => detectShortcut([start(), end()]))
  const range = createMemo(() => normalizeDateRange([start(), end()]))
  const valid = createMemo(() => !!range())

  const syncFromRange = (value?: DateRangeValue) => {
    const next = normalizeDateRange(value)
    setStart(next?.[0] ?? "")
    setEnd(next?.[1] ?? "")
    setPick(next ? next.map((item) => parseDate(item)) : [])
  }

  const syncDraft = (value: DateValue[]) => {
    const next = value.filter(Boolean)
    setPick(next)
    setStart(next[0]?.toString() ?? "")
    setEnd(next[1]?.toString() ?? "")
  }

  const handleOpenChange = (next: boolean) => {
    syncFromRange(props.value)
    setOpen(next)
  }

  const apply = () => {
    const next = range()
    if (!next) return
    props.onChange(next)
    syncFromRange(next)
    setOpen(false)
  }

  const clear = () => {
    syncFromRange(null)
    props.onChange(null)
    setOpen(false)
  }

  createEffect(() => {
    if (!open()) syncFromRange(props.value)
  })

  return (
    <div
      class={cn(
        "flex items-center gap-2 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_34%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_88%,var(--native-bg-subtle))] px-3 text-left shadow-[var(--native-shadow-sm)] transition-colors hover:border-[color:color-mix(in_oklab,var(--native-primary)_24%,var(--native-border))]",
        props.fullWidth === false ? "w-auto max-w-full" : "w-full",
        open() && "border-[color:color-mix(in_oklab,var(--native-primary)_40%,var(--native-border))]",
        sizeClass[props.size ?? "default"],
      )}
    >
      <span class={cn("min-w-0 flex-1 truncate whitespace-nowrap", filled() ? "text-[var(--native-foreground)]" : "text-[var(--native-dim)]")}>
        {label()}
      </span>

      <div class="ml-auto flex items-center gap-1">
        <Show when={props.clearable && filled()}>
          <button
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--native-dim)] transition-colors hover:bg-[var(--native-primary-soft)] hover:text-[var(--native-primary)]"
            onClick={(e) => {
              e.stopPropagation()
              clear()
            }}
            aria-label="Clear date range"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="h-3.5 w-3.5">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </Show>

        <Popover
          open={open()}
          onOpenChange={handleOpenChange}
          placement="bottom-end"
          gutter={8}
          flip={false}
          overflowPadding={16}
          triggerAs="button"
          triggerProps={{
            type: "button",
            class:
              "inline-flex h-8 w-8 items-center justify-center rounded-[var(--native-radius-sm)] text-[var(--native-dim)] transition-colors hover:bg-[var(--native-primary-soft)] hover:text-[var(--native-primary)]",
            "aria-label": "Open date range picker",
          }}
          class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[var(--native-panel)] p-0 shadow-[var(--native-shadow-lg)] [&_[data-slot=popover-body]]:p-0"
          style={{
            width: "min(760px, calc(100vw - 2rem))",
            "min-width": "0",
            "max-width": "min(760px, calc(100vw - 2rem))",
          }}
          trigger={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="h-4 w-4 shrink-0">
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18" />
            </svg>
          }
        >
          <DatePicker
            inline
            open
            closeOnSelect={false}
            selectionMode="range"
            numOfMonths={2}
            startOfWeek={1}
            value={pick()}
            onValueChange={(details) => syncDraft(details.value)}
            format={(item) => formatDay(item.toDate("UTC"))}
          >
            <DatePickerContent class="w-[min(760px,calc(100vw-2rem))] max-w-[min(760px,calc(100vw-2rem))] overflow-hidden rounded-[var(--native-radius-lg)] border-0 bg-[var(--native-panel)] p-0 shadow-none">
            <div class="flex flex-col md:flex-row md:gap-3">
              <div class="flex flex-wrap content-start gap-1 border-b border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] p-3 md:w-[120px] md:flex-none md:flex-col md:flex-nowrap md:border-b-0 md:pr-0">
                <For each={dateShortcuts}>
                  {(item) => (
                    <button
                      type="button"
                      class={cn(
                        "inline-flex h-8 w-[120px] items-center px-3 text-left text-[13px] leading-none whitespace-nowrap transition-colors",
                        active() === item.label
                          ? "rounded-[var(--native-radius-sm)] bg-[var(--native-primary)] text-[var(--native-primary-foreground)]"
                          : "rounded-none bg-transparent text-[var(--native-muted)] hover:bg-[var(--native-primary-soft)] hover:text-[var(--native-primary)]",
                      )}
                      onClick={() => {
                        const next = shortcutRange(item.days)
                        syncFromRange(next)
                        props.onChange(next)
                        handleOpenChange(false)
                      }}
                    >
                      {item.label}
                    </button>
                  )}
                </For>
              </div>

              <div class="min-w-0 flex-1 bg-[color:color-mix(in_oklab,var(--native-panel)_86%,var(--native-bg-subtle))] p-3 md:my-3 md:mr-3 md:ml-0 md:rounded-[var(--native-radius-md)] md:p-4">
                <DatePickerControl class="mb-4 sm:grid-cols-2">
                  <DatePickerInput index={0} placeholder="Start" />
                  <DatePickerInput index={1} placeholder="End" />
                </DatePickerControl>

                <DatePickerView view="day" class="gap-4">
                  <DatePickerContext>
                    {(api) => {
                      const offset = createMemo(() => api().getOffset({ months: 1 }))

                      return (
                        <>
                          <DatePickerViewControl>
                            <DatePickerPrevTrigger />
                            <DatePickerViewTrigger>
                              <DatePickerRangeText />
                            </DatePickerViewTrigger>
                            <DatePickerNextTrigger />
                          </DatePickerViewControl>

                          <div class="grid gap-4 md:grid-cols-2">
                            <DatePickerTable class="mx-auto w-full">
                              <DatePickerTableHead>
                                <DatePickerTableRow>
                                  <Index each={api().weekDays}>
                                    {(day) => <DatePickerTableHeader>{day().short}</DatePickerTableHeader>}
                                  </Index>
                                </DatePickerTableRow>
                              </DatePickerTableHead>
                              <DatePickerTableBody>
                                <Index each={api().weeks}>
                                  {(week) => (
                                    <DatePickerTableRow>
                                      <Index each={week()}>
                                        {(day) => (
                                          <DatePickerTableCell value={day()}>
                                            <DatePickerTableCellTrigger>{day().day}</DatePickerTableCellTrigger>
                                          </DatePickerTableCell>
                                        )}
                                      </Index>
                                    </DatePickerTableRow>
                                  )}
                                </Index>
                              </DatePickerTableBody>
                            </DatePickerTable>

                            <DatePickerTable class="mx-auto w-full">
                              <DatePickerTableHead>
                                <DatePickerTableRow>
                                  <Index each={api().weekDays}>
                                    {(day) => <DatePickerTableHeader>{day().short}</DatePickerTableHeader>}
                                  </Index>
                                </DatePickerTableRow>
                              </DatePickerTableHead>
                              <DatePickerTableBody>
                                <Index each={offset().weeks}>
                                  {(week) => (
                                    <DatePickerTableRow>
                                      <Index each={week()}>
                                        {(day) => (
                                          <DatePickerTableCell value={day()} visibleRange={offset().visibleRange}>
                                            <DatePickerTableCellTrigger>{day().day}</DatePickerTableCellTrigger>
                                          </DatePickerTableCell>
                                        )}
                                      </Index>
                                    </DatePickerTableRow>
                                  )}
                                </Index>
                              </DatePickerTableBody>
                            </DatePickerTable>
                          </div>
                        </>
                      )
                    }}
                  </DatePickerContext>
                </DatePickerView>

                <DatePickerView view="month" class="gap-4">
                  <DatePickerContext>
                    {(api) => (
                      <>
                        <DatePickerViewControl>
                          <DatePickerPrevTrigger />
                          <DatePickerViewTrigger>Select month</DatePickerViewTrigger>
                          <DatePickerNextTrigger />
                        </DatePickerViewControl>

                        <DatePickerTable class="mx-auto w-full">
                          <DatePickerTableBody>
                            <For each={api().getMonthsGrid({ columns: 4, format: "short" })}>
                              {(row) => (
                                <DatePickerTableRow>
                                  <For each={row}>
                                    {(month) => (
                                      <DatePickerTableCell value={month.value}>
                                        <DatePickerTableCellTrigger>{month.label}</DatePickerTableCellTrigger>
                                      </DatePickerTableCell>
                                    )}
                                  </For>
                                </DatePickerTableRow>
                              )}
                            </For>
                          </DatePickerTableBody>
                        </DatePickerTable>
                      </>
                    )}
                  </DatePickerContext>
                </DatePickerView>

                <DatePickerView view="year" class="gap-4">
                  <DatePickerContext>
                    {(api) => (
                      <>
                        <DatePickerViewControl>
                          <DatePickerPrevTrigger />
                          <DatePickerViewTrigger>Select year</DatePickerViewTrigger>
                          <DatePickerNextTrigger />
                        </DatePickerViewControl>

                        <DatePickerTable class="mx-auto w-full">
                          <DatePickerTableBody>
                            <For each={api().getYearsGrid({ columns: 4 })}>
                              {(row) => (
                                <DatePickerTableRow>
                                  <For each={row}>
                                    {(year) => (
                                      <DatePickerTableCell value={year.value}>
                                        <DatePickerTableCellTrigger>{year.label}</DatePickerTableCellTrigger>
                                      </DatePickerTableCell>
                                    )}
                                  </For>
                                </DatePickerTableRow>
                              )}
                            </For>
                          </DatePickerTableBody>
                        </DatePickerTable>
                      </>
                    )}
                  </DatePickerContext>
                </DatePickerView>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 border-t border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] px-4 py-3">
              <Show when={props.clearable}>
                <Button variant="ghost" size="sm" onClick={clear}>
                  Clear
                </Button>
              </Show>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  syncFromRange(props.value)
                  handleOpenChange(false)
                }}
              >
                Close
              </Button>
              <Button size="sm" disabled={!valid()} onClick={apply}>
                Apply
              </Button>
            </div>
            </DatePickerContent>
          </DatePicker>
        </Popover>
      </div>
    </div>
  )
}

export default DateRangePicker