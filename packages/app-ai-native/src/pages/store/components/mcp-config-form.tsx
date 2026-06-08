import { For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { mcpConfigApi, type McpConfigStatus, type McpFieldValue } from "../lib/api"
import { detectMcpFields, type McpField } from "../lib/mcp-config"
import { useLanguage } from "@/context/language"

interface Props {
  itemId: string
  // Normalized single-server MCP template ({command,args,env,...}) used for detection.
  metadata: Record<string, unknown> | null | undefined
  // Current masked status from the loaded item (pre-fills every field's value + hasValue).
  status?: McpConfigStatus
  // Called with the fresh masked status after a successful save, so the opener can re-gate.
  onSaved: (status: McpConfigStatus) => void
  class?: string
}

const INPUT_CLASS =
  "w-full h-9 rounded-md border border-border-weak-base bg-background-base px-3 text-sm text-text-strong outline-none transition-colors focus:border-border-strong"

// Inline "参数配置" form rendered in the detail sidebar / mobile body (no modal).
// Re-editable at any time: every field (secret or not) pre-fills with its current saved value
// and keeps showing it after save, so the user can see and fix mistakes. The heuristic still
// tags secrets in the upsert payload (for display masking elsewhere), but the form renders and
// pre-fills all fields identically — secrets are never hidden in this inline editor.
export function McpConfigForm(props: Props) {
  const language = useLanguage()

  // Detect fields with localized fallback labels for anonymous positional args.
  const fields = (): McpField[] =>
    detectMcpFields(props.metadata, {
      path: language.t("store.detail.mcpConfig.label.path"),
      arg: (n) => language.t("store.detail.mcpConfig.label.arg", { n }),
    })

  // statusByKey: what the server already has for each field (hasValue + value, for ALL fields).
  const statusByKey = (): Record<string, { hasValue: boolean; secret: boolean; value?: string }> =>
    Object.fromEntries((props.status?.fields ?? []).map((f) => [f.key, f]))

  // Local edit state. `values` holds the current input text per key; `dirty` marks keys the
  // user actually edited this session (so we only send changed keys → merge keeps the rest).
  const initialValues = (): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const f of fields()) {
      // Pre-fill every field from its saved value (secret fields included).
      out[f.key] = statusByKey()[f.key]?.value ?? ""
    }
    return out
  }

  const [form, setForm] = createStore({
    values: initialValues(),
    dirty: {} as Record<string, boolean>,
    error: "",
    saved: false,
    saving: false,
  })

  const setValue = (key: string, v: string) => {
    setForm("values", key, v)
    setForm("dirty", key, true)
    setForm("saved", false)
  }

  // A field counts as "filled" if the user typed something OR the server already has a value.
  const isFilled = (f: McpField): boolean => {
    const typed = form.values[f.key]?.trim()
    if (typed) return true
    if (form.dirty[f.key]) return false // user explicitly cleared it
    return Boolean(statusByKey()[f.key]?.hasValue)
  }

  const allRequiredFilled = (): boolean =>
    fields()
      .filter((f) => f.required)
      .every(isFilled)

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault()
    if (form.saving) return
    if (!allRequiredFilled()) {
      setForm("error", language.t("store.detail.mcpConfig.error.incomplete"))
      return
    }

    // Only send keys the user edited this session (merge upsert; empty v clears that key).
    const payload: Record<string, McpFieldValue> = {}
    for (const f of fields()) {
      if (!form.dirty[f.key]) continue
      payload[f.key] = { v: form.values[f.key]?.trim() ?? "", secret: f.secret }
    }

    setForm("error", "")
    setForm("saving", true)
    try {
      const res = await mcpConfigApi.upsert(props.itemId, payload)
      props.onSaved(res.mcpConfig)
      // Keep the form mounted (it stays inline) but reset dirty tracking so the saved values
      // become the new baseline; inputs keep showing the values they hold.
      setForm("dirty", {})
      setForm("saved", true)
    } catch (err) {
      setForm("error", err instanceof Error ? err.message : String(err))
    } finally {
      setForm("saving", false)
    }
  }

  return (
    <form onSubmit={handleSubmit} class={`space-y-3 ${props.class ?? ""}`.trim()}>
      <p class="text-12-regular leading-5 text-text-weak">{language.t("store.detail.mcpConfig.description")}</p>
      <For each={fields()}>
        {(field) => (
          <div class="space-y-1">
            <label class="flex items-center gap-1.5 text-12-regular text-text-strong">
              <span class="truncate" title={field.label}>
                {field.label}
              </span>
              <span class="text-[var(--native-error)]">*</span>
            </label>
            <input
              type="text"
              value={form.values[field.key] ?? ""}
              onInput={(e) => setValue(field.key, e.currentTarget.value)}
              placeholder={field.placeholder}
              class={INPUT_CLASS}
              autocomplete="off"
            />
          </div>
        )}
      </For>

      <Show when={form.error}>
        <p class="text-12-regular text-[var(--native-error)]">{form.error}</p>
      </Show>

      <div class="flex items-center gap-2">
        <button
          type="submit"
          disabled={form.saving || !allRequiredFilled()}
          class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[var(--native-primary)] bg-[var(--native-primary)] px-4 text-12-regular font-medium text-[var(--native-primary-foreground)] transition-colors hover:border-[var(--native-primary-hover)] hover:bg-[var(--native-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {form.saving ? language.t("common.saving") : language.t("store.detail.mcpConfig.save")}
        </button>
        <Show when={form.saved && !form.saving}>
          <span class="text-12-regular" style={{ color: "#22c55e" }}>
            {language.t("store.detail.mcpConfig.saved")}
          </span>
        </Show>
      </div>
    </form>
  )
}
