import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { DateRangePicker } from "./date-range-picker"
import { OrgCascadeSelect } from "./org-cascade-select"
import type { DateRangeValue, OrgCascadeValue } from "../../lib/types"

type Props = {
  dateRange?: DateRangeValue
  orgValue?: OrgCascadeValue
  showOrg?: boolean
  actions?: JSX.Element
  onDateRangeChange: (value: DateRangeValue) => void
  onOrgChange?: (value: OrgCascadeValue) => void
  onChange?: (value: { dateRange: DateRangeValue; orgValue: OrgCascadeValue }) => void
}

export function FilterBar(props: Props) {
  const language = useLanguage()
  const emit = (input: { dateRange: DateRangeValue; orgValue: OrgCascadeValue }) => {
    props.onChange?.(input)
  }

  return (
    <section class="rounded-[var(--native-radius-lg)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_90%,var(--native-bg-subtle))] p-4 shadow-[var(--native-shadow-sm)]">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div class="grid min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)]">
            <label class="flex min-w-0 flex-col gap-2">
              <span class="text-[0.75rem] text-[var(--native-muted)]">{language.t("kanban.filter.selectDateRange")}</span>
              <DateRangePicker
                value={props.dateRange}
                onChange={(value) => {
                  props.onDateRangeChange(value)
                  emit({ dateRange: value, orgValue: props.orgValue ?? {} })
                }}
                clearable={false}
                placeholder={language.t("kanban.filter.selectDateRange")}
              />
            </label>
          </div>

          {props.actions ? <div class="flex flex-wrap items-end gap-3">{props.actions}</div> : null}
        </div>

        {props.showOrg ? (
          <OrgCascadeSelect
            value={props.orgValue}
            dateRange={props.dateRange}
            onChange={(value) => {
              props.onOrgChange?.(value)
              emit({ dateRange: props.dateRange ?? null, orgValue: value })
            }}
          />
        ) : null}
      </div>
    </section>
  )
}

export default FilterBar