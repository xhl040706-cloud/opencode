import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { Show } from "solid-js"
import { useAuth } from "../hooks/use-auth"
import { getLoginUrl } from "../lib/auth"
import { NotificationChannelsSection } from "../components/notification-channels-section"

export default function DashboardNotifications() {
  const language = useLanguage()
  const { user, loading } = useAuth()

  return (
    <div class="min-h-full px-6 py-6">
      <Show
        when={!loading()}
        fallback={<div class="flex justify-center py-16 text-text-weak">{language.t("store.loading")}</div>}
      >
        <Show
          when={user()}
          fallback={
            <div class="flex min-h-[60vh] items-center justify-center">
              <div class="rounded-xl border border-border-weak-base bg-surface-raised-base px-8 py-10 text-center">
                <div class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-surface-info-base/20 text-text-strong">
                  <Icon name="console" />
                </div>
                <h1 class="text-lg font-semibold text-text-strong">{language.t("store.console")}</h1>
                <p class="mt-2 text-sm text-text-weak">{language.t("store.console.authDescription")}</p>
                <Button
                  class="mt-4"
                  onClick={() => {
                    window.location.href = getLoginUrl("/store/dashboard/notifications")
                  }}
                >
                  {language.t("store.console.login")}
                </Button>
              </div>
            </div>
          }
        >
          <NotificationChannelsSection />
        </Show>
      </Show>
    </div>
  )
}
