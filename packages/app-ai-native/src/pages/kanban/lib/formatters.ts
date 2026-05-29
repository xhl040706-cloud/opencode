export function formatDuration(value?: number | null, t: (key: string) => string = (k) => k) {
  if (value == null || value === 0) return "-"

  const minutes = Math.round(Number(value))
  if (!Number.isFinite(minutes) || minutes <= 0) return "-"
  if (minutes < 60) return `${minutes}${t("kanban.duration.minutes")}`
  if (minutes <= 480) {
    const hour = Math.floor(minutes / 60)
    const remain = minutes % 60
    return remain === 0 ? `${hour}${t("kanban.duration.hour")}` : `${hour}${t("kanban.duration.hours")}${remain}${t("kanban.duration.minutes")}`
  }
  return `${(minutes / 480).toFixed(1)}${t("kanban.duration.manDays")}`
}

export function formatLocalTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")
  const second = String(date.getSeconds()).padStart(2, "0")

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

export function formatPercent(value?: number | null, digits = 0) {
  if (value == null) return "-"
  const result = value.toFixed(digits)
  return `${result === "-0" ? "0" : result}%`
}

// V2 提效比：后端为小数口径（如 0.136），前端 ×100 显示为百分比。
export function formatV2Ratio(value?: number | null, digits = 1) {
  if (value == null) return "-"
  const num = Number(value)
  if (!Number.isFinite(num)) return "-"
  const pct = (num * 100).toFixed(digits)
  return `${pct === "-0.0" ? "0.0" : pct}%`
}

export function shortId(value?: string | null, size = 8) {
  if (!value) return "-"
  return value.slice(0, size)
}

// Need 边界来源（boundary_source）原始枚举 → i18n key 映射。
// 后端枚举：lv1_pr / lv2_branch / lv3_session / lv4_commit / lv5_orphan。
const BOUNDARY_SOURCE_KEYS: Record<string, string> = {
  lv1_pr: "kanban.need.boundary.lv1_pr",
  lv2_branch: "kanban.need.boundary.lv2_branch",
  lv3_session: "kanban.need.boundary.lv3_session",
  lv4_commit: "kanban.need.boundary.lv4_commit",
  lv5_orphan: "kanban.need.boundary.lv5_orphan",
}

// 把 boundary_source 原始值映射成可读文案；未知值原样返回。
export function formatBoundarySource(value: string | undefined | null, t: (key: string) => string = (k) => k) {
  if (!value) return "-"
  const key = BOUNDARY_SOURCE_KEYS[value]
  return key ? t(key) : value
}
