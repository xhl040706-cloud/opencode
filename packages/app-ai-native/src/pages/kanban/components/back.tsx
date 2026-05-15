import { useLocation, useNavigate } from "@solidjs/router"
import { useLanguage } from "@/context/language"

const KANBAN_BACK_STACK = "kanban_back_stack"
const KANBAN_BACK_NAV_KEY = "kanban_back_navigating"

export default function Back() {
  const language = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()

  const handleClick = () => {
    const stack = JSON.parse(sessionStorage.getItem(KANBAN_BACK_STACK) || "[]")
    const current = location.pathname

    if (stack.length > 0 && stack[stack.length - 1] === current) {
      stack.pop()
    }

    const from = stack[stack.length - 1]
    if (from) {
      sessionStorage.setItem(KANBAN_BACK_NAV_KEY, "true")
      sessionStorage.setItem(KANBAN_BACK_STACK, JSON.stringify(stack))
      navigate(from)
    } else {
      navigate("/kanban")
    }
  }

  return (
    <button
      type="button"
      class="inline-flex w-fit max-w-full self-start items-center gap-2 text-sm text-[var(--native-muted)] transition-colors hover:text-[var(--native-foreground)] cursor-pointer"
      onClick={handleClick}
    >
      <span>&lt;</span>
      <span>{language.t("kanban.back")}</span>
    </button>
  )
}
