import type { ParentProps } from "solid-js"
import { createEffect } from "solid-js"
import { useLocation } from "@solidjs/router"
import { Toast } from "@opencode-ai/ui/toast"
import { env } from "@/lib/env"

const KANBAN_BACK_STACK = "kanban_back_stack"
const KANBAN_BACK_NAV_KEY = "kanban_back_navigating"
const BASE_PATH = (env.BASE_PATH || import.meta.env.BASE_URL || "/").replace(/\/$/, "")

function toRelativePath(pathname: string): string {
  if (!BASE_PATH || BASE_PATH === "/") return pathname
  if (pathname.startsWith(BASE_PATH + "/")) {
    return pathname.slice(BASE_PATH.length)
  }
  if (pathname === BASE_PATH) return "/"
  return pathname
}

function getPageType(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length >= 3) {
    return parts.slice(0, -1).join('/')
  }
  return pathname
}

export default function KanbanLayout(props: ParentProps) {
  const location = useLocation()

  createEffect(() => {
    const pathname = toRelativePath(location.pathname)
    if (sessionStorage.getItem(KANBAN_BACK_NAV_KEY) === "true") {
      sessionStorage.removeItem(KANBAN_BACK_NAV_KEY)
      return
    }
    const stack = JSON.parse(sessionStorage.getItem(KANBAN_BACK_STACK) || "[]")

    const currentType = getPageType(pathname)
    const lastType = stack.length > 0 ? getPageType(stack[stack.length - 1]) : null
    if (lastType === currentType) {
      stack[stack.length - 1] = pathname
      sessionStorage.setItem(KANBAN_BACK_STACK, JSON.stringify(stack))
      return
    }

    if (stack.length > 0 && stack[stack.length - 1] === pathname) {
      return
    }

    const existingIndex = stack.lastIndexOf(pathname)
    if (existingIndex !== -1) {
      stack.length = existingIndex + 1
      sessionStorage.setItem(KANBAN_BACK_STACK, JSON.stringify(stack))
      return
    }

    stack.push(pathname)
    sessionStorage.setItem(KANBAN_BACK_STACK, JSON.stringify(stack))
  })

  return (
    <div class="thin-scrollbar relative h-full w-full min-h-0 overflow-x-hidden overflow-y-auto bg-background-base">
      <div class="pointer-events-none absolute inset-0 overflow-hidden">
        <div class="absolute left-[-8rem] top-[-8rem] h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--native-success)_8%,transparent),transparent_72%)]" />
        <div class="absolute bottom-[-9rem] right-[-8rem] h-[19rem] w-[19rem] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--native-warning)_8%,transparent),transparent_72%)]" />
      </div>
      {props.children}
      <Toast.Region />
    </div>
  )
}
