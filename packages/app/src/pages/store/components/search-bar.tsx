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
    <div class="relative flex gap-2">
      <div class="relative flex-1">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-text-weak text-sm">⌕</span>
        <input
          type="text"
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder ?? "Search..."}
          class="w-full pl-8 pr-3 py-2 text-sm border border-border-weak-base rounded-md bg-bg-base text-text-strong placeholder:text-text-weak focus:outline-none focus:ring-1 focus:ring-border-weak-base"
        />
      </div>
      {props.onSearch && (
        <button
          onClick={props.onSearch}
          class="px-4 py-2 text-sm font-medium text-text-strong bg-bg-muted border border-border-weak-base rounded-md hover:bg-bg-muted/80 transition-colors focus:outline-none focus:ring-1 focus:ring-border-weak-base"
        >
          检索
        </button>
      )}
    </div>
  )
}
