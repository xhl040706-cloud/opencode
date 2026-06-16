import { Button } from "@opencode-ai/ui/button"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { Dialog } from "@opencode-ai/ui/dialog"
import { TextField } from "@opencode-ai/ui/text-field"
import { Icon } from "@opencode-ai/ui/icon"
import { showToast } from "@opencode-ai/ui/toast"
import { Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { enterpriseApi, type EnterpriseCustomer } from "@/pages/store/lib/api"

// 与后端 server/internal/enterprise/service.go 校验对齐。
const MAX_NAME_BYTES = 256
const MAX_LOGO_BYTES = 512 * 1024

type Props = {
  mode: "create" | "edit"
  customer?: EnterpriseCustomer
  onSaved: () => void
}

export function EnterpriseFormDialog(props: Props) {
  const dialog = useDialog()
  const language = useLanguage()

  const [store, setStore] = createStore({
    name: props.customer?.name ?? "",
    logo: props.customer?.logo ?? "",
    ids: (props.customer?.ids ?? []).join("\n"),
    saving: false,
    dragOver: false,
  })

  let logoInput: HTMLInputElement | undefined

  const byteLen = (s: string) => new TextEncoder().encode(s).length

  // 与后端 server/internal/enterprise/service.go 校验对齐：data:image/ 前缀 + ;base64, +
  // MIME 子类型白名单（显式拒绝 image/svg+xml 等可执行/向量格式）+ base64 段可解码。
  const ALLOWED_LOGO_MIME = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"])
  const LOGO_DATA_URI_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/

  type LogoCheck = { ok: true } | { ok: false; reason: "invalid" | "unsupported" }

  function checkLogoDataUri(s: string): LogoCheck {
    const m = LOGO_DATA_URI_RE.exec(s)
    if (!m) return { ok: false, reason: "invalid" }
    const mime = m[1]
    const payload = m[2]
    if (!ALLOWED_LOGO_MIME.has(mime)) return { ok: false, reason: "unsupported" }
    try {
      atob(payload)
    } catch {
      return { ok: false, reason: "invalid" }
    }
    return { ok: true }
  }

  function toastLogoCheckFailure(reason: "invalid" | "unsupported") {
    const key =
      reason === "unsupported"
        ? "admin.enterprise.toast.logoUnsupportedType"
        : "admin.enterprise.toast.logoInvalid"
    showToast({ variant: "error", title: language.t(key) })
  }

  function applyLogo(dataUri: string) {
    const check = checkLogoDataUri(dataUri)
    if (!check.ok) {
      toastLogoCheckFailure(check.reason)
      return
    }
    if (dataUri.length > MAX_LOGO_BYTES) {
      showToast({ variant: "error", title: language.t("admin.enterprise.toast.logoTooLarge") })
      return
    }
    setStore("logo", dataUri)
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      showToast({ variant: "error", title: language.t("admin.enterprise.toast.logoNotImage") })
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => applyLogo((e.target?.result as string) ?? "")
    reader.readAsDataURL(file)
  }

  function handleInputChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setStore("dragOver", false)
    const file = e.dataTransfer?.files[0]
    if (file) handleFileSelect(file)
  }

  const parseIds = (raw: string): string[] =>
    raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const name = store.name.trim()
    if (!name) {
      showToast({ variant: "error", title: language.t("admin.enterprise.toast.nameRequired") })
      return
    }
    if (byteLen(name) > MAX_NAME_BYTES) {
      showToast({ variant: "error", title: language.t("admin.enterprise.toast.nameTooLong") })
      return
    }
    if (!store.logo) {
      showToast({ variant: "error", title: language.t("admin.enterprise.toast.logoRequired") })
      return
    }
    const logoCheck = checkLogoDataUri(store.logo)
    if (!logoCheck.ok) {
      toastLogoCheckFailure(logoCheck.reason)
      return
    }
    if (store.logo.length > MAX_LOGO_BYTES) {
      showToast({ variant: "error", title: language.t("admin.enterprise.toast.logoTooLarge") })
      return
    }

    const payload = { name, logo: store.logo, ids: parseIds(store.ids) }
    setStore("saving", true)
    try {
      if (props.mode === "edit" && props.customer) {
        await enterpriseApi.update(props.customer.id, payload)
      } else {
        await enterpriseApi.create(payload)
      }
      showToast({
        variant: "success",
        title: language.t(
          props.mode === "edit" ? "admin.enterprise.toast.updateSuccess" : "admin.enterprise.toast.createSuccess",
        ),
      })
      props.onSaved()
      dialog.close()
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.enterprise.toast.saveFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
      setStore("saving", false)
    }
  }

  return (
    <Dialog
      title={language.t(
        props.mode === "edit" ? "admin.enterprise.dialog.editTitle" : "admin.enterprise.dialog.createTitle",
      )}
      class="w-full max-w-[480px] mx-auto"
    >
      <form onSubmit={handleSubmit} class="flex flex-col gap-6 p-6 pt-0">
        <div class="flex flex-col gap-4">
          <TextField
            autofocus
            type="text"
            label={language.t("admin.enterprise.form.name")}
            placeholder={language.t("admin.enterprise.form.namePlaceholder")}
            value={store.name}
            onChange={(v) => setStore("name", v)}
          />

          <div class="flex flex-col gap-2">
            <label class="text-12-medium text-text-weak">{language.t("admin.enterprise.form.logo")}</label>
            <div class="flex gap-3 items-start">
              <div
                role="button"
                tabindex={0}
                aria-label={language.t("admin.enterprise.form.logo")}
                aria-describedby="admin-logo-hint"
                class="relative flex size-16 cursor-pointer items-center justify-center overflow-hidden rounded-md border transition-colors focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--native-primary)_20%,transparent)]"
                classList={{
                  "border-text-interactive-base": store.dragOver,
                  "border-border-base hover:border-border-strong": !store.dragOver,
                }}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault()
                  setStore("dragOver", true)
                }}
                onDragLeave={() => setStore("dragOver", false)}
                onClick={() => logoInput?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    logoInput?.click()
                  }
                }}
              >
                <Show
                  when={store.logo}
                  fallback={<Icon name="cloud-upload" size="large" class="text-text-weak" />}
                >
                  <img src={store.logo} alt={language.t("admin.enterprise.form.logo")} class="size-full object-contain" />
                </Show>
              </div>
              <input
                ref={(el) => (logoInput = el)}
                type="file"
                accept="image/*"
                class="hidden"
                onChange={handleInputChange}
              />
              <div class="flex flex-col gap-1.5 self-center text-12-regular text-text-weak">
                <span id="admin-logo-hint">{language.t("admin.enterprise.form.logoHint")}</span>
                <Show when={store.logo}>
                  <button
                    type="button"
                    class="cursor-pointer text-left text-text-interactive-base hover:underline"
                    onClick={() => setStore("logo", "")}
                  >
                    {language.t("admin.enterprise.form.logoClear")}
                  </button>
                </Show>
              </div>
            </div>
          </div>

          <TextField
            multiline
            label={language.t("admin.enterprise.form.ids")}
            description={language.t("admin.enterprise.form.idsHint")}
            placeholder={language.t("admin.enterprise.form.idsPlaceholder")}
            value={store.ids}
            onChange={(v) => setStore("ids", v)}
            class="max-h-24 w-full overflow-y-auto font-mono text-xs"
          />
        </div>

        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="large" onClick={() => dialog.close()}>
            {language.t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" size="large" disabled={store.saving}>
            {store.saving ? language.t("common.saving") : language.t("common.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
