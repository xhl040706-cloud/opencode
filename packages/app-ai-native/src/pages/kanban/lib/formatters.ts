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

export function formatDuration(value?: number | null) {
  if (value == null || value === 0) return "-"

  const minutes = Math.round(Number(value))
  if (!Number.isFinite(minutes) || minutes <= 0) return "-"
  if (minutes < 60) return `${minutes}分钟`
  if (minutes <= 480) {
    const hour = Math.floor(minutes / 60)
    const remain = minutes % 60
    return remain === 0 ? `${hour}小时` : `${hour}小时${remain}分钟`
  }
  return `${(minutes / 480).toFixed(1)}人天`
}

export function shortId(value?: string | null, size = 8) {
  if (!value) return "-"
  return value.slice(0, size)
}