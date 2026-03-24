import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { ItemCrudDialog } from "./item-crud-dialog"

export function StoreCreateButton(props: {
  itemType: "skill" | "subagent" | "command" | "mcp"
  label: string
  onCreated?: () => void
}) {
  const dialog = useDialog()

  function openCreateDialog() {
    dialog.show(() => <ItemCrudDialog itemType={props.itemType} onCreated={props.onCreated} />)
  }

  return (
    <Button size="small" class="!h-7" onClick={openCreateDialog}>
      <Icon name="plus" class="size-4" />
      {props.label}
    </Button>
  )
}
