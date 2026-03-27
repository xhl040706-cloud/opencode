import type { ParentProps } from "solid-js"
import { Toast } from "@opencode-ai/ui/toast"
import DashboardSidebar from "./dashboard-sidebar"

export default function DashboardLayout(props: ParentProps) {
  return (
    <>
      <div class="flex h-full w-full min-h-0">
        <DashboardSidebar />
        <div class="flex-1 min-h-0 overflow-y-auto">{props.children}</div>
      </div>
      <Toast.Region />
    </>
  )
}
