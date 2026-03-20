import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"

// 配置常量
export const EDITOR_CONTEXT_CONFIG = {
  /** 最大标签页数量 */
  MAX_TABS: 10,
  /** 上下文信息最大长度（字符数）*/
  MAX_CONTEXT_LENGTH: 2000,
}

// 编辑器上下文事件定义
export const EditorContextEvent = {
  Update: BusEvent.define(
    "editor.context.update",
    z.object({
      activeFile: z
        .object({
          relativePath: z.string(),
          fileRef: z.string(),
          selection: z
            .object({
              startLine: z.number(),
              endLine: z.number(),
            })
            .optional(),
        })
        .optional(),
      openTabs: z.array(z.string()),
    }),
  ),
}

// 内存中的编辑器上下文
export namespace EditorContext {
  export interface EditorContextData {
    activeFile?: {
      relativePath: string
      fileRef: string
      selection?: {
        startLine: number
        endLine: number
      }
    }
    openTabs: string[]
    updatedAt: number
  }

  let currentContext: EditorContextData | null = null

  export function setContext(ctx: Omit<EditorContextData, "updatedAt">): void {
    // 限制标签页数量
    const limitedTabs = ctx.openTabs.slice(0, EDITOR_CONTEXT_CONFIG.MAX_TABS)
    
    currentContext = {
      ...ctx,
      openTabs: limitedTabs,
      updatedAt: Date.now(),
    }
    
    // 发布事件（可选)
    Bus.publish(EditorContextEvent.Update, {
      activeFile: ctx.activeFile,
      openTabs: limitedTabs,
    })
  }

  export function getContext(): EditorContextData | null {
    return currentContext
  }

  export function formatForPrompt(): string {
    const ctx = currentContext
    if (!ctx) return ""

    const parts: string[] = []
    parts.push(`<editor_context>`)

    if (ctx.activeFile) {
      let activeFile = `IDE Visible Files: ${ctx.activeFile.fileRef}`
      if (ctx.activeFile.selection) {
        activeFile = activeFile +  `(Selection range: ${ctx.activeFile.selection.startLine}-${ctx.activeFile.selection.endLine})`
      }
      parts.push(activeFile)
    } else {
      parts.push(`IDE Visible Files: None`)
    }

    if (ctx?.openTabs?.length > 0) {
      parts.push(`IDE Open Tabs: ${ctx.openTabs.join(", ")}`)
    } else {
      parts.push(`IDE Open Tabs: None`)
    }

    parts.push(`</editor_context>`)

    const result = parts.join("\n")

    if (result.length > EDITOR_CONTEXT_CONFIG.MAX_CONTEXT_LENGTH) {
      return result.substring(0, EDITOR_CONTEXT_CONFIG.MAX_CONTEXT_LENGTH) + "..."
    }

    return result
  }
}
