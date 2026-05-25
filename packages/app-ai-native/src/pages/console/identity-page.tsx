import { createEffect, createSignal, For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { useAuth } from "@/context/auth"
import { getLoginUrl } from "@/pages/store/lib/auth"
import { Button } from "@/components/ui/button"
import { sx } from "@/pages/store/lib/styles"
import { listIdentities, unbindIdentity, startBind, type AuthIdentity } from "./lib/identity-api"
import { cn } from "@/lib/utils"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { ConfirmDialog } from "@/pages/store/components/confirm-dialog"

const PROVIDER_SVG: Record<string, string> = {
  idtrust: `<svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 14h2v2h-2v-2zm0-8h2v6h-2V7z"/></svg>`,
  github: `<svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`,
  phone: `<svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-4.2-5.78v1.75l3.2-2.99L12.8 9v1.7c-3.11.43-4.35 2.56-4.8 4.7 1.11-1.55 2.69-2.18 4.8-2.18z"/></svg>`,
}

const PROVIDER_META: Record<string, { labelKey: string; color: string }> = {
  idtrust: { labelKey: "console.identity.provider.idtrust", color: "#2563eb" },
  github: { labelKey: "console.identity.provider.github", color: "#24292f" },
  phone: { labelKey: "console.identity.provider.phone", color: "#16a34a" },
  casdoor: { labelKey: "console.identity.provider.casdoor", color: "#7c3aed" },
}

const ALL_PROVIDERS = ["idtrust", "github", "phone"] as const

export default function IdentityPage() {
  const language = useLanguage()
  const { user, loading: authLoading, logout, refreshUser } = useAuth()
  const dialog = useDialog()

  const [identities, setIdentities] = createSignal<AuthIdentity[]>([])
  const [loadingIdentities, setLoadingIdentities] = createSignal(false)
  const [unbindingProvider, setUnbindingProvider] = createSignal<string | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [bindSuccess, setBindSuccess] = createSignal(false)

  const fetchIdentities = async () => {
    setLoadingIdentities(true)
    setError(null)
    try {
      const list = await listIdentities()
      setIdentities(list)
    } catch (err: any) {
      setError(err.message || "Failed to load identities")
    } finally {
      setLoadingIdentities(false)
    }
  }

  const handleUnbind = (identity: AuthIdentity) => {
    if (visibleIdentities().length <= 1) {
      setError(language.t("console.identity.errorCannotUnbindLast"))
      return
    }
    dialog.show(() => (
      <ConfirmDialog
        title={language.t("console.identity.unbindConfirmTitle")}
        description={language.t("console.identity.unbindConfirm")}
        confirm={language.t("console.identity.unbind")}
        onConfirm={async () => {
          setUnbindingProvider(identity.provider)
          try {
            const result = await unbindIdentity(identity.provider)
            if (result.requireRelogin) {
              await logout()
              return
            }
            await Promise.all([fetchIdentities(), refreshUser()])
          } catch (err: any) {
            setError(err.message || "Failed to unbind")
          } finally {
            setUnbindingProvider(null)
          }
        }}
      />
    ))
  }

  const handleBind = async (provider: string) => {
    setError(null)
    try {
      const authUrl = await startBind(provider)
      window.location.href = authUrl
    } catch (err: any) {
      setError(err.message || "Failed to start binding")
    }
  }

  createEffect(() => {
    if (user()) fetchIdentities()
  })

  createEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("bind") === "success") {
      setBindSuccess(true)
      window.history.replaceState({}, "", window.location.pathname)
      setTimeout(() => setBindSuccess(false), 5000)
      fetchIdentities()
      refreshUser()
    }
  })

  const visibleIdentities = () => identities().filter((i) => ALL_PROVIDERS.includes(i.provider as any))
  const identityFor = (provider: string) => identities().find((i) => i.provider === provider)

  return (
    <Show when={!authLoading()} fallback={<div class={sx.empty}>{language.t("common.loading")}</div>}>
      <Show
        when={user()}
        fallback={
          <div class="flex min-h-[40vh] items-center justify-center">
            <div style={{ "text-align": "center" }}>
              <h1 class={sx.toolbarTitle}>{language.t("console.identity.title")}</h1>
              <p class="mb-3 text-[0.8125rem] text-[var(--native-muted)]">{language.t("console.identity.loginRequired")}</p>
              <Button type="button" size="sm" onClick={() => { window.location.href = getLoginUrl() }}>
                {language.t("store.console.login")}
              </Button>
            </div>
          </div>
        }
      >
        <section class={`${sx.section} pb-8`}>
          <div class={sx.toolbar}>
            <div>
              <h2 class={sx.toolbarTitle}>{language.t("console.identity.title")}</h2>
              <p class={cn(sx.toolbarSub, "max-w-none")}>{language.t("console.identity.description")}</p>
            </div>
          </div>

          <Show when={bindSuccess()}>
            <div class="mb-4 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,#16a34a_30%,transparent)] bg-[color:color-mix(in_oklab,#16a34a_8%,var(--native-panel))] px-4 py-3 text-[0.8125rem] text-[#16a34a]">
              {language.t("console.identity.bindSuccess")}
            </div>
          </Show>

          <Show when={error()}>
            <div class="mb-4 rounded-[var(--native-radius-md)] border border-[color:color-mix(in_oklab,#ef4444_30%,transparent)] bg-[color:color-mix(in_oklab,#ef4444_8%,var(--native-panel))] px-4 py-3 text-[0.8125rem] text-[#ef4444]">
              {error()}
              <button class="ml-2 underline" onClick={() => setError(null)}>
                {language.t("console.identity.dismiss")}
              </button>
            </div>
          </Show>

          <div class={sx.cshell}>
            <Show when={!loadingIdentities()} fallback={<div class={sx.state}><div class={sx.spinner} /></div>}>
              <div class="flex flex-col gap-3">
                <For each={ALL_PROVIDERS}>
                  {(providerKey) => {
                    const meta = PROVIDER_META[providerKey]
                    const identity = () => identityFor(providerKey)
                    const isBound = () => identity() !== undefined

                    return (
                      <div class="flex items-center justify-between rounded-[var(--native-radius-md)] border px-4 py-3 transition-colors"
                        classList={{
                          "border-[color:color-mix(in_oklab,var(--native-border)_40%,transparent)] bg-[var(--native-panel)]": !isBound(),
                          "border-[color:color-mix(in_oklab,var(--native-primary)_30%,transparent)] bg-[color:color-mix(in_oklab,var(--native-primary)_6%,var(--native-panel))]": isBound(),
                        }}
                      >
                        <div class="flex items-center gap-3">
                          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--native-radius-sm)]"
                            style={{ background: meta.color }}
                            innerHTML={PROVIDER_SVG[providerKey] ?? PROVIDER_SVG.idtrust}>
                          </div>
                          <div>
                            <span class="text-[0.8125rem] font-medium text-[var(--native-foreground)]">
                              {language.t(meta.labelKey)}
                            </span>
                          </div>
                        </div>

                        <Show when={isBound()} fallback={
                          <button type="button"
                            class="shrink-0 rounded-[var(--native-radius-sm)] bg-[color:color-mix(in_oklab,var(--native-primary)_12%,var(--native-panel))] px-4 py-1.5 text-[0.8125rem] font-medium text-[var(--native-primary)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--native-primary)_18%,var(--native-panel))]"
                            onClick={() => handleBind(providerKey)}>
                            {language.t("console.identity.bind")}
                          </button>
                        }>
                          <Button type="button" variant="ghost" size="sm"
                            disabled={unbindingProvider() === identity()?.provider || visibleIdentities().length <= 1}
                            onClick={() => handleUnbind(identity()!)}
                            class="shrink-0 px-3 text-[0.8125rem] text-[var(--native-muted)] hover:text-[#ef4444]"
                            title={visibleIdentities().length <= 1 ? language.t("console.identity.errorCannotUnbindLast") : ""}>
                            <Show when={unbindingProvider() !== identity()?.provider} fallback={<div class={sx.spinner} />}>
                              {language.t("console.identity.unbind")}
                            </Show>
                          </Button>
                        </Show>
                      </div>
                    )
                  }}
                </For>
              </div>
            </Show>
          </div>
        </section>
      </Show>
    </Show>
  )
}
