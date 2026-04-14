import type { ParentProps } from "solid-js"
import { Toast } from "@opencode-ai/ui/toast"
import ConsoleSidebar from "./console-sidebar"

export default function ConsoleLayout(props: ParentProps) {
  return (
    <>
      <div class="flex h-full w-full min-h-0">
        <ConsoleSidebar />
        <div class="custom-scrollbar flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(180deg,var(--native-bg-subtle),var(--native-bg))]">
          <div class="mx-auto flex max-w-[960px] flex-col gap-6 px-7 pt-6 pb-12 max-[768px]:p-4">
            {props.children}
          </div>
        </div>
      </div>
      <Toast.Region />
    </>
  )
}
