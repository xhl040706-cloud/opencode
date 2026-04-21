import { createEffect, createMemo, createSignal, For, Index, Show } from "solid-js"
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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { dateShortcuts, detectShortcut, formatDay, normalizeDateRange, shortcutRange } from "../../lib/date-range"
import type { DateRangeValue } from "../../lib/types"

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

  const range = createMemo(() => normalizeDateRange([start(), end()]))

  createEffect(() => {
    const next = normalizeDateRange(props.value)
    setStart(next?.[0] ?? "")
    setEnd(next?.[1] ?? "")
    setPick(next ? next.map((item) => parseDate(item)) : [])
  })

  const valid = createMemo(() => !!range())

  const sync = (next: DateValue[]) => {
    const list = next.filter(Boolean)
    setPick(list)
    setStart(list[0]?.toString() ?? "")
    setEnd(list[1]?.toString() ?? "")
  }

  const apply = () => {
    if (!range()) return
    props.onChange(range())
    props.onClose?.()
  }

  const clear = () => {
    setStart("")
    setEnd("")
    setPick([])
    props.onChange(null)
    props.onClose?.()
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
                  props.onChange(next)
                  props.onClose?.()
                }}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>

        <div class="min-w-0 flex-1 bg-[color:color-mix(in_oklab,var(--native-panel)_86%,var(--native-bg-subtle))] p-3 md:p-4">
          <DatePicker
            inline
            open
            closeOnSelect={false}
            selectionMode="range"
            numOfMonths={2}
            startOfWeek={1}
            value={pick()}
            onValueChange={(details) => sync(details.value)}
            format={(item) => formatDay(item.toDate("UTC"))}
          >
            <DatePickerControl>
              <DatePickerInput index={0} placeholder="Start" />
              <DatePickerInput index={1} placeholder="End" />
            </DatePickerControl>

            <DatePickerContent class="border-0 bg-transparent p-0 shadow-none">
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

                        <div class="flex flex-wrap gap-3">
                          <div class="min-w-[18rem] flex-1 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_26%,transparent)] bg-[var(--native-panel)] p-3 shadow-[var(--native-shadow-sm)]">
                            <div class="mb-2 text-center text-[0.75rem] font-semibold tracking-[0.04em] text-[var(--native-muted)]">
                              {monthLabel(api().visibleRange.start)}
                            </div>
                            <DatePickerTable class="mx-auto">
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
                          </div>

                          <div class="min-w-[18rem] flex-1 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_26%,transparent)] bg-[var(--native-panel)] p-3 shadow-[var(--native-shadow-sm)]">
                            <div class="mb-2 text-center text-[0.75rem] font-semibold tracking-[0.04em] text-[var(--native-muted)]">
                              {monthLabel(offset().visibleRange.start)}
                            </div>
                            <DatePickerTable class="mx-auto">
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
                        </div>
                      </>
                    )
                  }}
                </DatePickerContext>
              </DatePickerView>
            </DatePickerContent>
          </DatePicker>
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
          <Button size="sm" disabled={!valid()} onClick={apply}>
            Apply
          </Button>
      </div>
    </div>
  )
}

export default DateRangePanel