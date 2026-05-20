import { apiFetch } from "@/pages/store/lib/api"

function getAuthHeaders(): Record<string, string> {
  const match = document.cookie.match(/(?:^|;\s*)zgsmAdminToken=([^;]+)/)
  if (!match) return {}
  return { Authorization: `Bearer ${match[1]}` }
}

export interface QuotaList {
  amount: number
  expiry_date: string
  source?: string
}

export interface UsageConsumptionRecord {
  id: number
  user_id: string
  model: string
  mode: string
  tokens: number
  credits_used: number
  package: string
  record_time: string
  create_time: string
  update_time: string
}

export interface GetUsageStatisticsReq {
  page: number
  page_size: number
  start_time?: string
  end_time?: string
  time_range?: string
}

export interface GetUsageStatisticsRes {
  records: Array<UsageConsumptionRecord>
  total: number
  page: number
  page_size: number
}

export interface GetUserQuotaRes {
  total_quota: number
  used_quota: number
  quota_list: Array<QuotaList>
  is_star?: string
}

export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

export async function getUserQuota(): Promise<GetUserQuotaRes> {
  const res = await apiFetch<ApiResponse<GetUserQuotaRes>>("/quota-manager/api/v1/quota", {
    credentials: "include",
    headers: getAuthHeaders(),
  })
  return res.data
}

export async function getUsageStatistics(params: GetUsageStatisticsReq): Promise<GetUsageStatisticsRes> {
  const query = new URLSearchParams()
  query.set("page", String(params.page))
  query.set("page_size", String(params.page_size))
  if (params.start_time) query.set("start_time", params.start_time)
  if (params.end_time) query.set("end_time", params.end_time)
  if (params.time_range) query.set("time_range", params.time_range)

  const res = await apiFetch<ApiResponse<GetUsageStatisticsRes>>(
    `/quota-manager/api/v1/usage/statistics?${query.toString()}`,
    { credentials: "include", headers: getAuthHeaders() }
  )
  return res.data
}
