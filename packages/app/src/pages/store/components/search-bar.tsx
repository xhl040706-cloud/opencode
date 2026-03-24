import { Icon } from "@opencode-ai/ui/icon"
import { Button } from "@opencode-ai/ui/button"

export default function SearchBar(props: {
  value: string
  onChange: (v: string) => void
  onSearch?: () => void
  placeholder?: string
}) {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && props.onSearch) {
      props.onSearch()
    }
  }

  return (
    <div class="relative flex gap-1.5">
      <div class="relative flex-1">
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-icon-base">
          <Icon name="magnifying-glass" class="size-3.5" />
        </span>
        <input
          type="text"
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder ?? "Search..."}
          style={{ outline: "none" }}
          class="w-full h-7 pl-7.5 pr-3 text-xs font-medium border-0 rounded-md bg-button-secondary-base text-text-strong shadow-xs-border-base placeholder:text-text-weak focus:shadow-xs-border-focus"
        />
      </div>
      {props.onSearch && (
        <Button size="small" class="!h-7" variant="secondary" onClick={props.onSearch} title="Semantic search">
          <Icon name="magnifying-glass-menu" class="size-3.5" />
        </Button>
      )}
    </div>
  )
}
