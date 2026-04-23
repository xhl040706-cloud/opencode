import { A } from "@solidjs/router"

export default function Back() {
  return (
    <A href="/kanban" class="inline-flex items-center gap-2 text-sm text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)]">
      <span>&lt;</span>
      <span>返回看板</span>
    </A>
  )
}