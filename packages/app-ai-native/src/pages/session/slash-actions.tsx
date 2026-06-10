import { useNavigate, useParams } from "@solidjs/router"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { useConversationAdapter } from "@/context/device-adapter"
import { DialogSelectFile } from "@/components/dialog-select-file"
import { DialogSelectModel } from "@/components/dialog-select-model"
import { DialogSelectMcp } from "@/components/dialog-select-mcp"
import { DialogSelectAgent } from "@/components/dialog-select-agent"
import { DialogSelectVariant } from "@/components/dialog-select-variant"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { DialogSessionRename } from "@/components/dialog-session-rename"
import { DialogSessionList } from "@/components/dialog-session-list"
import { DialogTimeline } from "@/components/dialog-timeline"
import { DialogThemeList } from "@/components/dialog-theme-list"
import { DialogHelp } from "@/components/dialog-help"
import { DialogCredit } from "@/components/dialog-credit"
import { DialogStatus } from "@/components/dialog-status"
import { DialogSkills } from "@/components/dialog-skills"
import { DialogFavorites } from "@/components/dialog-favorites"
function exportTranscriptAsMarkdown(messages: any[], getParts: (id: string) => any[]): string {
  const lines: string[] = []
  for (const message of messages) {
    const role = message.role === "user" ? "User" : "Assistant"
    lines.push(`## ${role}`, "")
    for (const part of getParts(message.id)) {
      if (part.type === "text" && !part.synthetic && !part.ignored) lines.push(part.text, "")
      if (part.type === "reasoning") lines.push(`_Thinking:_ ${part.text}`, "")
      if (part.type === "tool") lines.push(`> Tool: ${part.tool}`, "")
    }
  }
  return lines.join("\n")
}

export function useSlashActions() {
  const dialog = useDialog()
  const navigate = useNavigate()
  const params = useParams()
  const sync = useSync()
  const sdk = useSDK()
  const conversation = useConversationAdapter()
  const language = useLanguage()
  const layout = useLayout()

  const sessionID = () => (sync as any).currentSessionID?.()
  const directory = () => sdk.directory

  const execute = (name: string) => {
    switch (name) {
      case "new":
      case "clear": {
        navigate(`/workspace/${params.workspaceID ?? ""}`)
        return
      }
      case "sessions":
      case "resume":
      case "continue": {
        dialog.show(() => <DialogSessionList />)
        return
      }
      case "workspaces": {
        const dir = directory()
        if (dir) layout.sidebar.toggleWorkspaces(dir)
        return
      }
      case "models": {
        dialog.show(() => <DialogSelectModel />)
        return
      }
      case "agents": {
        dialog.show(() => <DialogSelectAgent />)
        return
      }
      case "mcps": {
        dialog.show(() => <DialogSelectMcp />)
        return
      }
      case "variants": {
        dialog.show(() => <DialogSelectVariant />)
        return
      }
      case "connect": {
        dialog.show(() => <DialogSelectProvider />)
        return
      }
      case "status": {
        dialog.show(() => <DialogStatus />)
        return
      }
      case "credit": {
        window.open("/console/usage", "_blank")
        return
      }
      case "themes": {
        dialog.show(() => <DialogThemeList />)
        return
      }
      case "help": {
        dialog.show(() => <DialogHelp />)
        return
      }
      case "hub":
      case "favorites": {
        dialog.show(() => <DialogFavorites />)
        return
      }
      case "skills": {
        dialog.show(() => <DialogSkills />)
        return
      }
      case "rename": {
        dialog.show(() => <DialogSessionRename />)
        return
      }
      case "timeline": {
        dialog.show(() => <DialogTimeline />)
        return
      }

      case "copy": {
        const sid = sessionID()
        if (!sid) {
          showToast({ title: language.t("command.session.copy.noSession") })
          return
        }
        const messages = sync.data.message[sid] ?? []
        const md = exportTranscriptAsMarkdown(messages, (msgID) => sync.data.part[msgID] ?? [])
        navigator.clipboard
          .writeText(md)
          .then(() =>
            showToast({
              title: language.t("command.session.copy.success"),
              variant: "success",
            }),
          )
          .catch(() =>
            showToast({
              title: language.t("command.session.copy.error"),
              variant: "error",
            }),
          )
        return
      }

      case "timestamps":
      case "toggle-timestamps": {
        showToast({ title: language.t("command.timestamps.placeholder") })
        return
      }
      case "thinking":
      case "toggle-thinking": {
        showToast({ title: language.t("command.thinking.placeholder") })
        return
      }
      case "open": {
        dialog.show(() => <DialogSelectFile onOpenFile={() => {}} />)
        return
      }
      case "terminal": {
        layout.view(sessionID() ?? "").terminal.toggle()
        return
      }
    }

    const sid = sessionID()
    if (!sid) return
    conversation.sessionCommand({ sessionID: sid, command: name }).catch((err) =>
      showToast({
        title: language.t("prompt.toast.commandSendFailed.title"),
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      }),
    )
  }

  return { execute }
}
