import type { ParentProps } from "solid-js"
import { Toast } from "@opencode-ai/ui/toast"

export default function KanbanLayout(props: ParentProps) {
  return (
    <div class="thin-scrollbar relative h-full w-full min-h-0 overflow-x-hidden overflow-y-auto bg-background-base before:pointer-events-none before:absolute before:left-[-8rem] before:top-[-8rem] before:h-[18rem] before:w-[18rem] before:rounded-full before:bg-[radial-gradient(circle,color-mix(in_oklab,var(--native-success)_8%,transparent),transparent_72%)] before:content-[''] after:pointer-events-none after:absolute after:bottom-[-9rem] after:right-[-8rem] after:h-[19rem] after:w-[19rem] after:rounded-full after:bg-[radial-gradient(circle,color-mix(in_oklab,var(--native-warning)_8%,transparent),transparent_72%)] after:content-['']">
      {props.children}
      <Toast.Region />
    </div>
  )
}