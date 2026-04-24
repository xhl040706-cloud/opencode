import { A } from "@solidjs/router"
import { useLanguage } from "@/context/language"

export default function Back(props: { href?: string; label?: string }) {
  const language = useLanguage()
  const href = props.href?.trim() || "/kanban"
  const label = props.label?.trim() || language.t("kanban.back")

  return (
    <A href={href} class="inline-flex items-center gap-2 text-sm text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)]">
      <span>&lt;</span>
      <span>{label}</span>
    </A>
  )
}
