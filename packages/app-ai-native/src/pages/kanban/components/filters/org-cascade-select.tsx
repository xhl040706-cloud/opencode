import { For } from "solid-js"
import { cn } from "@/lib/utils"
import { useOrgCascade } from "../../hooks/use-org-cascade"
import type { DateRangeValue, OrgCascadeValue } from "../../lib/types"

type Props = {
  value?: OrgCascadeValue
  dateRange?: DateRangeValue
  onChange: (value: OrgCascadeValue) => void
  class?: string
}

export function OrgCascadeSelect(props: Props) {
  const cascade = useOrgCascade({
    value: props.value,
    dateRange: props.dateRange,
    onChange: props.onChange,
  })

  return (
    <div class={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-4", props.class)}>
      <For each={cascade.levels()}>
        {(item) => (
          <label class="flex min-w-0 flex-col gap-2">
            <span class="text-[0.75rem] text-[var(--native-muted)]">{item.label}</span>
            <select
              class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              value={item.value}
              disabled={item.disabled}
              onChange={(e) => void cascade.setLevel(item.level, e.currentTarget.value)}
            >
              <option value="">全部</option>
              <For each={item.options}>
                {(option) => <option value={option}>{option}</option>}
              </For>
            </select>
          </label>
        )}
      </For>
    </div>
  )
}

export default OrgCascadeSelect