import type { JSX } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Icon } from "@opencode-ai/ui/icon"
import type { Device } from "../types"
import { RemoteDirectorySelector } from "./remote-directory-selector"

export type CreateWorkspaceDialogProps = {
  device: Device
  onCreate: (directory: string) => Promise<void> | void
}

export function CreateWorkspaceDialogContent(props: CreateWorkspaceDialogProps) {
  const dialog = useDialog()

  const handleSelect = async (directory: string | null) => {
    if (directory) {
      await props.onCreate(directory)
    }
    dialog.close()
  }

  return (
    <Dialog
      title={
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-surface-base">
            <Icon name="folder" class="size-5 text-text-strong" />
          </div>
          <div class="flex flex-col">
            <span class="text-16-medium text-text-strong">选择工作目录</span>
            <span class="text-13-regular text-text-weak">
              在设备 "{props.device.displayName}" 上选择
            </span>
          </div>
        </div>
      }
      class="w-full max-w-[480px] mx-auto"
    >
      <RemoteDirectorySelector
        device={props.device}
        onSelect={handleSelect}
      />
    </Dialog>
  )
}
