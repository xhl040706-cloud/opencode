import type { ParentProps } from "solid-js"
import { Toast } from "@opencode-ai/ui/toast"
import "../projects.css"

export default function ProjectsLayout(props: ParentProps) {
  return (
    <div class="custom-scrollbar h-full w-full min-h-0 overflow-y-auto bg-[linear-gradient(180deg,var(--native-bg-subtle),var(--native-bg))]">
      {props.children}
      <Toast.Region />
    </div>
  )
}
