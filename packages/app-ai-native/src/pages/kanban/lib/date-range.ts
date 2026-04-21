import type { DateRangeValue } from "./types"

export type DateShortcut = {
  label: string
  days: number
}

export const dateShortcuts: DateShortcut[] = [
  { label: "Today", days: 0 },
  { label: "1 day ago", days: 1 },
  { label: "3 days ago", days: 3 },
  { label: "1 week ago", days: 7 },
  { label: "1 month ago", days: 30 },
  { label: "3 months ago", days: 90 },
]

function pad(v: number) {
  return String(v).padStart(2, "0")
}

export function formatDay(input: string | Date) {
  if (input instanceof Date) {
    return `${input.getFullYear()}-${pad(input.getMonth() + 1)}-${pad(input.getDate())}`
  }

  const txt = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) return txt
  if (/^\d{8}$/.test(txt)) return `${txt.slice(0, 4)}-${txt.slice(4, 6)}-${txt.slice(6, 8)}`
  return txt
}

export function normalizeDateRange(value?: DateRangeValue) {
  if (!value || value.length !== 2) return null
  const start = formatDay(value[0])
  const end = formatDay(value[1])
  if (!start || !end) return null
  return [start, end] as [string, string]
}

export function displayDateRange(value?: DateRangeValue, placeholder = "Select date range") {
  const next = normalizeDateRange(value)
  if (!next) return placeholder
  return `${next[0]}  To  ${next[1]}`
}

export function shortcutRange(days: number, now = new Date()) {
  const end = new Date(now)
  const start = new Date(now)
  if (days === 0) {
    start.setHours(0, 0, 0, 0)
  } else {
    start.setDate(start.getDate() - days)
  }
  return [formatDay(start), formatDay(end)] as [string, string]
}

export function defaultWideRange(days = 90, now = new Date()) {
  return shortcutRange(Math.max(days - 1, 0), now)
}

export function detectShortcut(value?: DateRangeValue) {
  const current = normalizeDateRange(value)
  if (!current) return ""
  const match = dateShortcuts.find((item) => {
    const next = shortcutRange(item.days)
    return next[0] === current[0] && next[1] === current[1]
  })
  return match?.label ?? ""
}

export function hasRange(value?: DateRangeValue) {
  return !!normalizeDateRange(value)
}