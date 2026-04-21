import { env } from "@/lib/env"
import {
  addRepoToProjectMock,
  checkProjectConflictsMock,
  createProjectOptionMock,
  getRepoDetailMock,
  listRepoBranchesMock,
  loadProjectOptionsMock,
  queryRepoRowsMock,
  repoMock,
} from "../mock/repo"
import type {
  CorrectionHistoryItem,
  CorrectionPayload,
  Data,
  DateRangeValue,
  DateValue,
  DimensionKeysQuery,
  EfficiencyQuery,
  EfficiencyQueryResult,
  EfficiencyRow,
  EfficiencySummary,
  FetchOpts,
  OrgListQuery,
  ProjectConflict,
  ProjectOption,
  RepoAggregateRow,
  RepoBindingPayload,
  RepoCommitRow,
  RepoDetailQuery,
  RepoDetailResult,
  RepoListQuery,
  RepoListResult,
  RepoTaskRow,
  Shape,
} from "./types"

const PREFIX = env.API_PREFIX
const BASE = env.API_URL || PREFIX
const LONG = 600000
const API = "/api"

function plain(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

function clean(v: unknown): unknown {
  if (typeof v === "string") return v.trim()
  if (Array.isArray(v)) return v.map(clean).filter((item) => item !== undefined)
  if (!plain(v)) return v

  return Object.fromEntries(
    Object.entries(v)
      .map(([k, item]) => [k, clean(item)] as const)
      .filter(([, item]) => item !== undefined),
  )
}

function append(q: URLSearchParams, k: string, v: unknown) {
  if (v === undefined || v === null) return
  if (Array.isArray(v)) {
    v.forEach((item) => append(q, k, item))
    return
  }
  if (v instanceof Date) {
    q.append(k, v.toISOString())
    return
  }
  if (plain(v)) {
    q.append(k, JSON.stringify(v))
    return
  }
  q.append(k, String(v))
}

function query(params?: Shape) {
  if (!params) return ""

  const q = new URLSearchParams()
  const data = clean(params)
  if (plain(data)) {
    Object.entries(data).forEach(([k, v]) => append(q, k, v))
  }
  const txt = q.toString()
  return txt ? `?${txt}` : ""
}

function body(data: unknown) {
  if (data === undefined) return undefined
  return JSON.stringify(clean(data))
}

function fail(err: string, raw?: unknown): never {
  throw new Error(err, raw ? { cause: raw } : undefined)
}

function takeArray(raw: unknown, keys: string[]) {
  if (Array.isArray(raw)) return raw
  if (!plain(raw)) return undefined
  for (const key of keys) {
    const value = raw[key]
    if (Array.isArray(value)) return value
    if (plain(value)) {
      for (const nested of keys) {
        const child = value[nested]
        if (Array.isArray(child)) return child
      }
    }
  }
}

function toDay(v?: DateValue | null) {
  if (!v) return undefined
  if (v instanceof Date) {
    return `${v.getFullYear()}${String(v.getMonth() + 1).padStart(2, "0")}${String(v.getDate()).padStart(2, "0")}`
  }
  const txt = v.trim()
  if (!txt) return undefined
  if (/^\d{8}$/.test(txt)) return txt
  return txt.replace(/-/g, "")
}

function range(range?: DateRangeValue) {
  if (!range) return {}
  return {
    startDate: toDay(range[0]),
    endDate: toDay(range[1]),
  }
}

function toNumber(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function toText(v: unknown) {
  return typeof v === "string" ? v : undefined
}

function toRows(raw: unknown) {
  if (!Array.isArray(raw)) return [] as EfficiencyRow[]
  return raw.filter(plain).map((item) => ({ ...item })) as EfficiencyRow[]
}

function toObjects<T extends Record<string, unknown>>(raw: unknown) {
  if (!Array.isArray(raw)) return [] as T[]
  return raw.filter(plain).map((item) => ({ ...item } as T))
}

function summary(raw: unknown): EfficiencySummary {
  if (!plain(raw)) fail("Invalid efficiency response", raw)

  const ai = plain(raw.ai_estimated) ? raw.ai_estimated : {}
  const actual = plain(raw.actual_time) ? raw.actual_time : {}
  const eff = plain(raw.efficiency) ? raw.efficiency : {}
  const cost = plain(raw.cost) ? raw.cost : {}
  const users = toRows(Array.isArray(actual.users) ? actual.users : [])

  return {
    dimension: raw.dimension === "repo" ? "repo" : "work_dir",
    dimension_id: toText(raw.dimension_id) ?? "",
    analysis_date: toText(raw.analysis_date),
    ai_estimated: {
      raw_days: toNumber(ai.raw_days),
      corrected_days: ai.corrected_days == null ? null : toNumber(ai.corrected_days),
      is_corrected: Boolean(ai.is_corrected),
      reasons: Array.isArray(ai.reasons) ? ai.reasons.filter((item): item is string => typeof item === "string") : [],
    },
    actual_time: {
      total_lead_time_ms: toNumber(actual.total_lead_time_ms),
      total_process_time_ms: toNumber(actual.total_process_time_ms),
      total_code_lines: toNumber(actual.total_code_lines),
      user_count: toNumber(actual.user_count),
      start_time: toText(actual.start_time),
      end_time: toText(actual.end_time),
      users,
    },
    efficiency: {
      ratio_lead: toNumber(eff.ratio_lead),
      ratio_process: toNumber(eff.ratio_process),
      reason: toText(eff.reason),
    },
    cost: {
      api_cost: toNumber(cost.api_cost),
      daily_rate: toNumber(cost.daily_rate),
      cost_saving: toNumber(cost.cost_saving),
      roi: toNumber(cost.roi),
    },
    analysis_file: toText(raw.analysis_file),
  }
}

function page<T>(items: T[], index = 1, size = items.length || 1) {
  const start = Math.max(index - 1, 0) * Math.max(size, 1)
  return items.slice(start, start + Math.max(size, 1))
}

async function apiFetch<T = unknown>(path: string, opts: FetchOpts = {}): Promise<T> {
  const ctrl = new AbortController()
  const timeout = opts.timeout ?? 0
  const id = timeout > 0 ? globalThis.setTimeout(() => ctrl.abort(), timeout) : undefined
  const method = opts.method ?? (opts.data === undefined ? "GET" : "POST")
  const init: RequestInit = {
    method,
    // credentials: "include",
    signal: ctrl.signal,
  }
  const payload = body(opts.data)

  if (payload !== undefined) {
    init.body = payload
    init.headers = { "Content-Type": "application/json" }
  }

  try {
    const res = await fetch(`${BASE}${path}${query(opts.params)}`, init)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || err.message || `Request failed: ${res.status}`)
    }
    return res.json()
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(timeout > 0 ? `Request timed out after ${timeout}ms` : "Request aborted")
    }
    throw err
  } finally {
    if (id !== undefined) globalThis.clearTimeout(id)
  }
}

function get<T = unknown>(path: string, params?: Shape, timeout?: number) {
  return apiFetch<T>(path, { method: "GET", params, timeout })
}

function post<T = unknown>(path: string, data?: Data, params?: Shape, timeout?: number) {
  return apiFetch<T>(path, { method: "POST", data, params, timeout })
}

function put<T = unknown>(path: string, data?: Data, params?: Shape, timeout?: number) {
  return apiFetch<T>(path, { method: "PUT", data, params, timeout })
}

function del<T = unknown>(path: string, data?: Data, params?: Shape, timeout?: number) {
  return apiFetch<T>(path, { method: "DELETE", data, params, timeout })
}

export async function listOrgs(input: OrgListQuery) {
  const raw = await get<unknown>(`${API}/v2/orgs`, {
    level: input.level,
    parent: input.parent,
    ...range(input.dateRange),
  })
  const list = takeArray(raw, ["data", "items"])
  if (!list) return [] as string[]
  return list
    .map((item) => (plain(item) && typeof item.org_name === "string" ? item.org_name : undefined))
    .filter((item): item is string => !!item)
}

export async function loadDimensionKeys(input: DimensionKeysQuery) {
  const raw = await get<unknown>(`${API}/aggregate/keys`, {
    dimension: input.dimension,
    ...range(input.dateRange),
  }, LONG)

  if (plain(raw) && Array.isArray(raw.keys)) {
    return { keys: raw.keys.filter((item): item is string => typeof item === "string") }
  }

  if (plain(raw) && plain(raw.data) && Array.isArray(raw.data.keys)) {
    return { keys: raw.data.keys.filter((item): item is string => typeof item === "string") }
  }

  return { keys: [] as string[] }
}

export async function queryEfficiencyRows(input: EfficiencyQuery): Promise<EfficiencyQueryResult> {
  const txt = input.dimensionId.trim()
  if (!txt) fail("dimensionId is required")
  if (!input.dateRange) fail("dateRange is required")

  const raw = await get<unknown>(`${API}/analysis/efficiency`, {
    dimension: input.dimension,
    id: txt,
    ...range(input.dateRange),
  }, LONG)

  const data = summary(raw)
  const all = data.actual_time.users
  const index = input.page ?? 1
  const size = input.pageSize ?? (all.length || 1)

  return {
    rows: page(all, index, size),
    total: all.length,
    summary: data,
  }
}

export async function queryRepoRows(input: RepoListQuery): Promise<RepoListResult> {
  if (repoMock()) return queryRepoRowsMock(input)

  const currentPage = input.page ?? 1
  const currentSize = input.pageSize ?? 250
  const raw = await get<unknown>(`${API}/v2/repos`, {
    ...range(input.dateRange),
    page: currentPage,
    pageSize: currentSize,
  }, LONG)

  const rows = toObjects<RepoAggregateRow>(takeArray(raw, ["data", "items"]) ?? [])
  const meta = plain(raw) ? raw : {}

  return {
    rows,
    total: toNumber(meta.total) || rows.length,
    page: toNumber(meta.page) || currentPage,
    pageSize: toNumber(meta.pageSize) || currentSize,
  }
}

export async function getRepoDetail(input: RepoDetailQuery): Promise<RepoDetailResult> {
  if (repoMock()) return getRepoDetailMock(input)

  const repoAddr = input.repoAddr.trim()
  if (!repoAddr) fail("repoAddr is required")

  const raw = await get<unknown>(`${API}/v2/repos/detail`, {
    repoAddr,
    repoBranch: input.repoBranch?.trim(),
    ...range(input.dateRange),
  }, LONG)

  if (!plain(raw)) fail("Invalid repo detail response", raw)

  return {
    repo_addr: toText(raw.repo_addr) ?? repoAddr,
    repo_branch: toText(raw.repo_branch),
    branches: Array.isArray(raw.branches) ? raw.branches.filter((item): item is string => typeof item === "string") : [],
    commits: toObjects<RepoCommitRow>(raw.commits),
    tasks: toObjects<RepoTaskRow>(raw.tasks),
    efficiency: plain(raw.efficiency) ? {
      repo_ancient_minutes: toNumber(raw.efficiency.repo_ancient_minutes),
      repo_real_minutes: toNumber(raw.efficiency.repo_real_minutes),
      efficiency_ratio: raw.efficiency.efficiency_ratio == null ? null : toNumber(raw.efficiency.efficiency_ratio),
      repo_ancient_minutes_reason: toText(raw.efficiency.repo_ancient_minutes_reason),
      repo_real_minutes_reason: toText(raw.efficiency.repo_real_minutes_reason),
    } : {},
    summary: plain(raw.summary) ? {
      commit_count: toNumber(raw.summary.commit_count),
      task_count: toNumber(raw.summary.task_count),
    } : {},
  }
}

export async function listRepoBranches(repoAddr: string) {
  const txt = repoAddr.trim()
  if (!txt) return [] as string[]
  if (repoMock()) return listRepoBranchesMock(txt)

  const raw = await get<unknown>(`${API}/v2/repos/branches`, { repoAddr: txt }, LONG)
  if (plain(raw) && Array.isArray(raw.branches)) {
    return raw.branches.filter((item): item is string => typeof item === "string")
  }
  return [] as string[]
}

export async function loadProjectOptions() {
  if (repoMock()) return loadProjectOptionsMock()

  const raw = await get<unknown>(`${API}/v2/projects`, undefined, LONG)
  const list = takeArray(raw, ["data", "items"])
  if (!list) return [] as ProjectOption[]
  return list
    .filter(plain)
    .map((item) => ({
      project_id: toText(item.project_id) ?? toText(item.id) ?? "",
      name: toText(item.name) ?? "",
      description: toText(item.description),
    }))
    .filter((item) => item.project_id && item.name)
}

export async function createProjectOption(input: { name: string; description?: string }) {
  if (repoMock()) return createProjectOptionMock(input)

  const raw = await post<unknown>(`${API}/v2/projects`, {
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
  }, undefined, LONG)

  if (!plain(raw)) fail("Invalid project create response", raw)

  return {
    project_id: toText(raw.project_id) ?? toText(raw.id) ?? "",
    name: toText(raw.name) ?? input.name.trim(),
    description: toText(raw.description),
  } satisfies ProjectOption
}

export async function checkProjectConflicts(commitIds: string[]) {
  const ids = commitIds.map((item) => item.trim()).filter(Boolean)
  if (!ids.length) return [] as ProjectConflict[]
  if (repoMock()) return checkProjectConflictsMock(ids)

  const raw = await post<unknown>(`${API}/v2/projects/check-conflicts`, { commit_ids: ids }, undefined, LONG)
  const list = takeArray(raw, ["conflicts", "data"])
  if (!list) return [] as ProjectConflict[]

  return list
    .filter(plain)
    .map((item) => ({
      commit_id: toText(item.commit_id) ?? "",
      project_id: toText(item.project_id) ?? "",
      project_name: toText(item.project_name) ?? "",
    }))
    .filter((item) => item.commit_id && item.project_id)
}

export async function addRepoToProject(projectId: string, payload: RepoBindingPayload) {
  const id = projectId.trim()
  if (!id) fail("projectId is required")
  if (repoMock()) return addRepoToProjectMock(id, payload)

  return post<unknown>(`${API}/v2/projects/${encodeURIComponent(id)}/repos`, {
    repo_addr: payload.repo_addr.trim(),
    repo_branch: payload.repo_branch?.trim() || "",
    start_time: payload.start_time?.trim() || null,
    end_time: payload.end_time?.trim() || null,
    exclude_commits: (payload.exclude_commits ?? []).map((item) => item.trim()).filter(Boolean),
    include_only_commits: (payload.include_only_commits ?? []).map((item) => item.trim()).filter(Boolean),
  }, undefined, LONG)
}

export async function submitCorrection(input: CorrectionPayload) {
  const payload = {
    dimension: input.dimension,
    id: input.dimensionId.trim(),
    startDate: toDay(input.startDate),
    endDate: toDay(input.endDate),
    field: input.field ?? "ai_estimated_days",
    value: input.value,
    reason: input.reason.trim(),
    by: input.operator.trim(),
  }

  if (!payload.id) fail("dimensionId is required")
  if (!payload.startDate || !payload.endDate) fail("startDate and endDate are required")
  if (!payload.reason) fail("reason is required")
  if (!payload.by) fail("operator is required")

  const raw = await put<unknown>(`${API}/analysis/efficiency/correct`, payload, undefined, LONG)
  return summary(raw)
}

export async function loadCorrectionHistory(input: {
  dimension: CorrectionPayload["dimension"]
  dimensionId: string
  dateRange?: DateRangeValue
}) {
  const raw = await get<unknown>(`${API}/analysis/efficiency/history`, {
    dimension: input.dimension,
    id: input.dimensionId.trim(),
    ...range(input.dateRange),
  })

  const list = takeArray(raw, ["items", "data"])
  if (!list) return [] as CorrectionHistoryItem[]
  return list.filter(plain).map((item) => ({
    field_name: toText(item.field_name),
    old_value: toText(item.old_value),
    new_value: toText(item.new_value),
    reason: toText(item.reason),
    corrected_by: toText(item.corrected_by),
    corrected_at: toText(item.corrected_at),
  }))
}

export const kanbanApi = {
  listOrgs,
  loadDimensionKeys,
  queryEfficiencyRows,
  queryRepoRows,
  getRepoDetail,
  listRepoBranches,
  loadProjectOptions,
  createProjectOption,
  checkProjectConflicts,
  addRepoToProject,
  submitCorrection,
  loadCorrectionHistory,
}