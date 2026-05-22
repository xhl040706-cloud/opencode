import type { Locale } from "@/context/language"

export interface LocalizedItem {
  description?: string | null
  descriptions?: Record<string, string> | null
}

export function pickItemDescription(item: LocalizedItem | null | undefined, locale: Locale | string): string {
  if (!item) return ""
  const map = item.descriptions
  if (map) {
    const localized = map[locale]
    if (localized) return localized
    const en = map.en
    if (en) return en
  }
  return item.description ?? ""
}
