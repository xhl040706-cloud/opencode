import { createSignal, createMemo, Show } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import type { Device } from "../types"
import { RemoteDirectorySelector } from "./remote-directory-selector"
import { useLanguage } from "@/context/language"
import { deviceFileApi } from "../lib/cloud-device-api"

export type CreateWorkspaceDialogProps = {
  device: Device
  onCreate: (directory: string, name: string) => Promise<void> | void
}

export function CreateWorkspaceDialogContent(props: CreateWorkspaceDialogProps) {
  const language = useLanguage()
  const t = language.t
  const dialog = useDialog()
  const [homePath, setHomePath] = createSignal("/")
  const [path, setPath] = createSignal("")
  const [browse, setBrowse] = createSignal(false)
  const [name, setName] = createSignal("")
  const [submitting, setSubmitting] = createSignal(false)

  const suggested = createMemo(() => {
    return "New Project"
  })

  deviceFileApi.getDefaultPath(props.device.deviceId)
    .then((p) => {
      setHomePath(p)
      setPath(p)
    })
    .catch(() => {
      setHomePath("/")
      setPath("/")
    })

  const valid = () => {
    const v = path().trim()
    if (!v) return false
    // Accept absolute paths: Unix /... or Windows C:\... or C:/...
    if (v.startsWith("/")) return true
    if (/^[A-Za-z]:[/\\]/.test(v)) return true
    return false
  }

  const submit = async () => {
    const v = path().trim()
    if (!v) return
    setSubmitting(true)
    try {
      await props.onCreate(v, name().trim() || suggested())
    } finally {
      setSubmitting(false)
    }
    dialog.close()
  }

  const handleBrowseSelect = async (dir: string | null) => {
    if (dir) {
      setPath(dir)
      setBrowse(false)
    } else {
      setBrowse(false)
    }
  }

  return (
    <Dialog
      class="w-full max-w-[520px] mx-auto min-h-auto"
      title={
        <div class="flex items-center gap-2.5">
          <div class="flex items-center justify-center size-8 rounded-lg bg-surface-raised-base">
            <Icon name="folder" class="size-4 text-text-strong" />
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-14-medium text-text-strong">选择一个代码项目</span>
            <span class="text-12-regular text-text-weak">
              选择设备中的具体项目目录，CoStrict Cloud 将基于该目录创建工作空间。
            </span>
          </div>
        </div>
      }
    >
      <div class="flex flex-col gap-4 px-5 pb-5">
        <Show
          when={!browse()}
          fallback={
            <RemoteDirectorySelector
              device={props.device}
              initialPath={path() || homePath()}
              onSelect={handleBrowseSelect}
              onCancel={() => setBrowse(false)}
            />
          }
        >
          {/* Path input */}
          <div class="flex flex-col gap-2">
            <label class="text-12-medium text-text-weak">项目目录</label>
            <div class="flex items-center gap-2">
              <div class="flex-1 flex items-center gap-2 h-9 px-3 bg-surface-base rounded-lg border border-border-weak-base focus-within:border-border-strong-base transition-colors">
                <Icon name="folder" class="size-4 text-text-weak shrink-0" />
                <input
                  type="text"
                  placeholder={homePath() !== "/" ? homePath() : t("workspace.directory.pathPlaceholder")}
                  value={path()}
                  onInput={(e) => setPath((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && valid()) submit()
                  }}
                  autofocus
                  class="flex-1 text-13-regular bg-transparent placeholder:text-text-weaker focus:outline-none text-text-strong"
                />
              </div>
              <button
                type="button"
                class="flex items-center justify-center size-9 rounded-lg border border-border-weak-base bg-surface-base hover:bg-surface-base-hover transition-colors shrink-0"
                title={t("workspace.directory.browse")}
                onClick={() => setBrowse(true)}
              >
                <Icon name="file-tree" class="size-4 text-text-weak" />
              </button>
            </div>
            <Show when={path().trim() && !valid()}>
              <span class="text-11-regular text-text-critical-base">{t("workspace.directory.pathRequired")}</span>
            </Show>
            <span class="text-11-regular leading-[1.5] text-text-weak">
              建议选择包含代码仓库的具体项目目录，不要直接选择整个用户目录。只有你选择的目录会作为当前项目上下文。
            </span>
          </div>

          <div class="flex flex-col gap-2">
            <label class="text-12-medium text-text-weak">所在设备</label>
            <div class="flex items-center gap-2 rounded-lg border border-border-weak-base bg-surface-base px-3 py-2 text-13-regular text-text-strong">
              <Icon name="server" class="size-4 shrink-0 text-text-weak" />
              <span class="min-w-0 truncate">{props.device.displayName}</span>
            </div>
          </div>

          {/* Name input */}
          <div class="flex flex-col gap-2">
            <label class="text-12-medium text-text-weak">工作空间名称</label>
            <div class="flex items-center gap-2 h-9 px-3 bg-surface-base rounded-lg border border-border-weak-base focus-within:border-border-strong-base transition-colors">
              <Icon name="edit" class="size-4 text-text-weak shrink-0" />
              <input
                type="text"
                placeholder={t("workspace.directory.namePlaceholder")}
                value={name() || suggested()}
                onInput={(e) => {
                  setName((e.target as HTMLInputElement).value)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit()
                }}
                class="flex-1 text-13-regular bg-transparent placeholder:text-text-weaker focus:outline-none text-text-strong"
              />
            </div>
          </div>

          {/* Actions */}
          <div class="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="normal" onClick={() => dialog.close()}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="primary" size="normal" disabled={!valid() || submitting()} onClick={submit}>
              {submitting() ? t("workspace.create.creating") : "创建工作空间并进入"}
            </Button>
          </div>
        </Show>
      </div>
    </Dialog>
  )
}
