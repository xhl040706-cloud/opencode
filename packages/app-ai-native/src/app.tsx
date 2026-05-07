import "@/index.css"
import { File } from "@opencode-ai/ui/file"
import { I18nProvider } from "@opencode-ai/ui/context"
import { DialogProvider } from "@opencode-ai/ui/context/dialog"
import { FileComponentProvider } from "@opencode-ai/ui/context/file"
import { MarkedProvider } from "@opencode-ai/ui/context/marked"
import { Font } from "@opencode-ai/ui/font"
import { ThemeProvider } from "@opencode-ai/ui/theme"
import { MetaProvider } from "@solidjs/meta"
import { Navigate } from "@solidjs/router"
import { createEffect, ErrorBoundary, type ParentProps, lazy, Suspense } from "solid-js"
import { TerminalProvider } from "@/context/terminal"
import { FileProvider } from "@/context/file"
import { PromptProvider } from "@/context/prompt"
import { CommentsProvider } from "@/context/comments"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { LanguageProvider } from "@/context/language"
import { SettingsProvider } from "@/context/settings"
import { AuthProvider } from "@/context/auth"
import { ItemFilterOptionsProvider } from "@/context/item-filter-options"
import { ErrorPage } from "./pages/error"
import { useTheme } from "@opencode-ai/ui/theme"

const Session = lazy(() => import("@/pages/session"))

const Loading = () => <div class="size-full" />

function SessionProviders(props: ParentProps) {
  return (
    <TerminalProvider>
      <FileProvider>
        <PromptProvider>
          <CommentsProvider>{props.children}</CommentsProvider>
        </PromptProvider>
      </FileProvider>
    </TerminalProvider>
  )
}

export const SessionRoute = () => (
  <SessionProviders>
    <Suspense fallback={<Loading />}>
      <Session />
    </Suspense>
  </SessionProviders>
)

export const SessionIndexRoute = () => <Navigate href="session" />

function UiI18nBridge(props: ParentProps) {
  const language = useLanguage()
  return <I18nProvider value={{ locale: language.locale, t: language.t }}>{props.children}</I18nProvider>
}

function FixedExperienceGuards(props: ParentProps) {
  const theme = useTheme()

  createEffect(() => {
    if (theme.themeId() !== "vercel") {
      theme.setTheme("vercel")
    }

    if (theme.colorScheme() !== "light") {
      theme.setColorScheme("light")
    }
  })

  return props.children
}

function MarkedProviderWithNativeParser(props: ParentProps) {
  const platform = usePlatform()
  return <MarkedProvider nativeParser={platform.parseMarkdown}>{props.children}</MarkedProvider>
}

export function AppBaseProviders(props: ParentProps) {
  return (
    <MetaProvider>
      <Font />
      <ThemeProvider defaultTheme="vercel">
        <LanguageProvider>
          <SettingsProvider>
            <FixedExperienceGuards>
              <UiI18nBridge>
                <ErrorBoundary fallback={(error) => <ErrorPage error={error} />}>
                  <DialogProvider>
                    <MarkedProviderWithNativeParser>
                      <FileComponentProvider component={File}>
                        <AuthProvider>
                          <ItemFilterOptionsProvider>{props.children}</ItemFilterOptionsProvider>
                        </AuthProvider>
                      </FileComponentProvider>
                    </MarkedProviderWithNativeParser>
                  </DialogProvider>
                </ErrorBoundary>
              </UiI18nBridge>
            </FixedExperienceGuards>
          </SettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    </MetaProvider>
  )
}
