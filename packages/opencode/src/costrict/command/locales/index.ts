import ZH_CN_PROJECT_WIKI from "./zh-CN/project-wiki.txt"
import ZH_CN_ENHANCED_INIT from "./zh-CN/enhanced-initialize.txt"
import EN_PROJECT_WIKI from "./en/project-wiki.txt"
import EN_ENHANCED_INIT from "./en/enhanced-initialize.txt"

const COMMANDS: Record<string, Record<string, string>> = {
  "project-wiki": { "zh-CN": ZH_CN_PROJECT_WIKI, en: EN_PROJECT_WIKI },
  "enhanced-initialize": { "zh-CN": ZH_CN_ENHANCED_INIT, en: EN_ENHANCED_INIT },
}

export namespace CommandLocale {
  export function get(name: string, lang: string): string {
    return COMMANDS[name]?.[lang] ?? COMMANDS[name]?.en ?? ""
  }
}
