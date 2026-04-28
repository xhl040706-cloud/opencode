import { Component, createMemo } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"

export const DialogSkills: Component = () => {
  const dialog = useDialog()
  const language = useLanguage()
  const sync = useSync()

  const skills = createMemo(() =>
    Object.values(sync.data.command).filter((c) => c.source === "skill"),
  )

  return (
    <Dialog
      title={language.t("command.skills.title")}
      description={language.t("command.skills.description")}
    >
      <List
        items={skills()}
        key={(s) => s.name}
        onSelect={() => dialog.close()}
      >
        {(s) => (
          <div class="flex flex-col">
            <span class="text-sm font-medium">{s.title || s.name}</span>
            {s.description && (
              <span class="text-xs text-foreground-muted">{s.description}</span>
            )}
          </div>
        )}
      </List>
    </Dialog>
  )
}
