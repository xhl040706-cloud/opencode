import { For } from "solid-js"
import { useLanguage } from "@/context/language"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { TextField, TextFieldInput, TextFieldLabel } from "@/components/ui/text-field"
import { deriveFilterOptions } from "../../lib/filter-utils"
import type { DateRangeValue, EfficiencyRow, FilterValue, KanbanColumn, OrgCascadeValue } from "../../lib/types"
import { DateRangePicker } from "../filters/date-range-picker"
import { OrgCascadeSelect } from "../filters/org-cascade-select"
import { SearchCreateSelect } from "../filters/search-create-select"

type Props<Row extends EfficiencyRow> = {
  column: KanbanColumn<Row>
  rows: Row[]
  value: FilterValue | undefined
  dateRange?: DateRangeValue
  onChange: (value: FilterValue | undefined) => void
  onApply: () => void
  onReset: () => void
}

export function FilterPanel<Row extends EfficiencyRow>(props: Props<Row>) {
  const language = useLanguage()
  const options = () => deriveFilterOptions(props.column, props.rows)
  const type = () => props.column.filter?.type
  const shortcuts = () => props.column.filter?.shortcuts ?? []

  return (
    <div class="flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-4 p-4">
      <div>
        <div class="text-sm font-semibold text-[var(--native-foreground)]">{language.t("kanban.filter.title", { label: props.column.label })}</div>
        <div class="mt-1 text-[0.75rem] text-[var(--native-muted)]">{language.t("kanban.filter.description")}</div>
      </div>

      {type() === "text" ? (
        <TextField class="gap-2">
          <TextFieldLabel class="text-[0.75rem] text-[var(--native-muted)]">{language.t("kanban.filter.keyword")}</TextFieldLabel>
          <TextFieldInput value={(props.value as string) ?? ""} onInput={(e) => props.onChange(e.currentTarget.value)} placeholder={props.column.filter?.placeholder ?? language.t("kanban.filter.enterKeyword")} />
        </TextField>
      ) : null}

      {type() === "search-select" ? (
        <SearchCreateSelect
          value={(props.value as string) ?? ""}
          options={options()}
          onChange={(value) => props.onChange(value)}
          onCreate={(value) => props.onChange(value)}
          clearable
          placeholder={props.column.filter?.placeholder ?? language.t("kanban.filter.selectOrEnter")}
        />
      ) : null}

      {type() === "date" ? (
        <DateRangePicker value={(props.value as DateRangeValue) ?? null} onChange={props.onChange} clearable placeholder={props.column.filter?.placeholder ?? language.t("kanban.filter.selectDateRange")} />
      ) : null}

      {type() === "number" ? (
        <div class="grid gap-3 sm:grid-cols-2">
          <TextField class="gap-2">
            <TextFieldLabel class="text-[0.75rem] text-[var(--native-muted)]">{language.t("kanban.filter.min")}</TextFieldLabel>
            <TextFieldInput type="number" value={String((props.value as { min?: number })?.min ?? "")} onInput={(e) => props.onChange({ ...(props.value as { min?: number; max?: number }), min: e.currentTarget.value ? Number(e.currentTarget.value) : undefined })} />
          </TextField>
          <TextField class="gap-2">
            <TextFieldLabel class="text-[0.75rem] text-[var(--native-muted)]">{language.t("kanban.filter.max")}</TextFieldLabel>
            <TextFieldInput type="number" value={String((props.value as { max?: number })?.max ?? "")} onInput={(e) => props.onChange({ ...(props.value as { min?: number; max?: number }), max: e.currentTarget.value ? Number(e.currentTarget.value) : undefined })} />
          </TextField>
        </div>
      ) : null}

      {type() === "enum" || type() === "multi-select" ? (
        <div class="grid gap-2 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] p-3">
          <For each={options()}>
            {(item) => {
              const selected = () => ((props.value as string[]) ?? []).includes(item.value)
              return (
                <label class="flex items-center gap-2 text-sm text-[var(--native-foreground)]">
                  <Checkbox checked={selected()} onChange={(checked) => {
                    const current = new Set((props.value as string[]) ?? [])
                    if (checked) current.add(item.value)
                    else current.delete(item.value)
                    props.onChange(Array.from(current))
                  }} />
                  <span>{item.label}</span>
                </label>
              )
            }}
          </For>
        </div>
      ) : null}

      {type() === "cascade-org" ? (
        <OrgCascadeSelect value={(props.value as OrgCascadeValue) ?? {}} dateRange={props.dateRange} onChange={props.onChange as (value: OrgCascadeValue) => void} />
      ) : null}

      {shortcuts().length ? (
        <div class="flex flex-wrap gap-2">
          <For each={shortcuts()}>
            {(item) => (
              <button
                type="button"
                class="rounded-full border border-[color:color-mix(in_oklab,var(--native-border)_24%,transparent)] bg-[color:color-mix(in_oklab,var(--native-surface)_82%,var(--native-panel))] px-3 py-1 text-[0.75rem] text-[var(--native-muted)] transition-colors hover:bg-[var(--native-primary-soft)] hover:text-[var(--native-primary)]"
                onClick={() => props.onChange(item.value as FilterValue)}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      ) : null}

      <div class="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={props.onReset}>{language.t("common.reset")}</Button>
        <Button size="sm" onClick={props.onApply}>{language.t("common.apply")}</Button>
      </div>
    </div>
  )
}

export default FilterPanel