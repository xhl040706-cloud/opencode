import { createMemo, Match, Show, Switch } from "solid-js"
import { Dynamic } from "solid-js/web"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { useFileComponent } from "@opencode-ai/ui/context/file"
import { useFile } from "@/context/file"
import { useLanguage } from "@/context/language"
import type { ContentTab } from "@/context/content-tabs"

export function FilePreviewTab(props: { tab: ContentTab }) {
  const file = useFile()
  const language = useLanguage()
  const fileComponent = useFileComponent()

  const path = createMemo(() => props.tab.meta.path as string | undefined)
  const state = createMemo(() => {
    const p = path()
    if (!p) return
    return file.get(p)
  })
  const contents = createMemo(() => (state()?.content as { content?: string } | undefined)?.content ?? "")

  const renderFile = (source: string) => (
    <div class="relative overflow-hidden pb-40">
      <Dynamic
        component={fileComponent}
        mode="text"
        file={{
          name: path() ?? "",
          contents: source,
        }}
        overflow="scroll"
        class="select-text"
        media={{
          mode: "auto",
          path: path(),
          current: state()?.content,
          onError: () => {},
        }}
      />
    </div>
  )

  return (
    <div class="h-full flex flex-col">
      <Switch>
        <Match when={state()?.loaded}>
          <ScrollView class="h-full">
            {renderFile(contents())}
          </ScrollView>
        </Match>
        <Match when={state()?.loading}>
          <div class="flex-1 flex items-center justify-center text-text-weak text-14-regular">
            {language.t("common.loading")}...
          </div>
        </Match>
        <Match when={state()?.error}>
          <div class="flex-1 flex items-center justify-center text-text-weak text-14-regular">
            {state()?.error}
          </div>
        </Match>
      </Switch>
    </div>
  )
}
