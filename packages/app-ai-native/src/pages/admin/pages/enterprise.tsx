import { useDialog } from "@opencode-ai/ui/context/dialog"
import { showToast } from "@opencode-ai/ui/toast"
import { For, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { Button } from "@/components/ui/button"
import { enterpriseApi, type EnterpriseCustomer } from "@/pages/store/lib/api"
import { refetchEnterprise } from "@/pages/store/lib/enterprise"
import { ConfirmDialog } from "@/pages/store/components/confirm-dialog"
import { EnterpriseFormDialog } from "../components/enterprise-form-dialog"
import { sx } from "../lib/styles"

export default function AdminEnterprise() {
  const language = useLanguage()
  const dialog = useDialog()
  const [state, setState] = createStore<{ customers: EnterpriseCustomer[]; loading: boolean }>({
    customers: [],
    loading: true,
  })

  async function load() {
    setState("loading", true)
    try {
      const res = await enterpriseApi.list()
      setState("customers", res.customers ?? [])
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("admin.enterprise.toast.loadFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setState("loading", false)
    }
  }

  onMount(() => {
    void load()
  })

  // 保存/删除后：刷新后台列表 + 同步刷新 store 品牌缓存。
  const onSaved = () => {
    void load()
    void refetchEnterprise()
  }

  const openCreate = () => dialog.show(() => <EnterpriseFormDialog mode="create" onSaved={onSaved} />)
  const openEdit = (c: EnterpriseCustomer) =>
    dialog.show(() => <EnterpriseFormDialog mode="edit" customer={c} onSaved={onSaved} />)
  const openDelete = (c: EnterpriseCustomer) =>
    dialog.show(() => (
      <ConfirmDialog
        title={language.t("admin.enterprise.delete.title")}
        description={language.t("admin.enterprise.delete.description", { name: c.name })}
        onConfirm={async () => {
          await enterpriseApi.remove(c.id)
          showToast({ variant: "success", title: language.t("admin.enterprise.toast.deleteSuccess") })
          onSaved()
        }}
      />
    ))

  return (
    <section class={sx.section}>
      <div class={sx.head}>
        <div>
          <h1 class={sx.title}>{language.t("admin.enterprise.title")}</h1>
          <p class={sx.sub}>{language.t("admin.enterprise.subtitle")}</p>
        </div>
        <Button onClick={openCreate} class="cursor-pointer">
          {language.t("admin.enterprise.create")}
        </Button>
      </div>

      <div class={sx.tableShell}>
        <Show when={state.loading}>
          <div class={sx.overlay}>
            <div class={sx.spinner} />
          </div>
        </Show>

        <table class={sx.dtStatic}>
          <thead>
            <tr>
              <th class="w-16">{language.t("admin.enterprise.columns.logo")}</th>
              <th>{language.t("admin.enterprise.columns.name")}</th>
              <th class="w-28">{language.t("admin.enterprise.columns.accounts")}</th>
              <th class="w-32 text-right">{language.t("admin.enterprise.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            <For each={state.customers}>
              {(c) => (
                <tr>
                  <td>
                    <img src={c.logo} alt={c.name} class="h-8 w-8 rounded object-contain" />
                  </td>
                  <td class="font-semibold text-[var(--native-foreground)]">{c.name}</td>
                  <td class="text-[var(--native-muted)] [font-variant-numeric:tabular-nums]">{c.ids?.length ?? 0}</td>
                  <td class="text-right">
                    <div class="inline-flex gap-3">
                      <button
                        type="button"
                        class="cursor-pointer text-[var(--native-primary)] transition-colors hover:underline"
                        onClick={() => openEdit(c)}
                      >
                        {language.t("admin.enterprise.actions.edit")}
                      </button>
                      <button
                        type="button"
                        class="cursor-pointer text-[var(--native-error)] transition-colors hover:underline"
                        onClick={() => openDelete(c)}
                      >
                        {language.t("admin.enterprise.actions.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>

        <Show when={!state.loading && state.customers.length === 0}>
          <div class={sx.state}>{language.t("admin.enterprise.empty")}</div>
        </Show>
      </div>
    </section>
  )
}
