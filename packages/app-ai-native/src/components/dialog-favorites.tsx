import { Component, createMemo } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { List } from "@opencode-ai/ui/list"
import { useLanguage } from "@/context/language"
import { useSync } from "@/context/sync"

export const DialogFavorites: Component = () => {
  const dialog = useDialog()
  const language = useLanguage()
  const sync = useSync()

  const favorites = createMemo(() =>
    Object.values(sync.data.command).filter((c) => c.source === "skill"),
  )

  return (
    <Dialog
      title={language.t("command.favorites.title")}
      description={language.t("command.favorites.description")}
    >
      <List
        items={favorites()}
        key={(f) => f.name}
        onSelect={() => dialog.close()}
      >
        {(f) => (
          <div class="flex flex-col">
            <span class="text-sm font-medium">{f.title || f.name}</span>
            {f.description && (
              <span class="text-xs text-foreground-muted">{f.description}</span>
            )}
          </div>
        )}
      </List>
    </Dialog>
  )
}
