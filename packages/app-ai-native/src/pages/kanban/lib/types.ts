import type { JSX } from "solid-js"

export type Atom = string | number | boolean | null

export type Data = Atom | Date | Data[] | { [key: string]: Data | undefined }

export type Shape = Record<string, Data | undefined>

export type DateValue = string | Date

export type DateRangeValue = [string, string] | null

export type OrgLevel = "org1" | "org2" | "org3" | "org4"

export type OrgCascadeValue = Partial<Record<OrgLevel, string>>

export type EfficiencyDimension = "work_dir" | "repo"

export type FilterType = "text" | "number" | "enum" | "date" | "search-select" | "multi-select" | "cascade-org"

export type NumberRangeValue = {
  min?: number
  max?: number
}

export type FilterValue = string | string[] | DateRangeValue | OrgCascadeValue | NumberRangeValue | null

export type FilterValueMap = Record<string, FilterValue | undefined>

export type FilterOption = {
  label: string
  value: string
}

export type FilterTag = {
  prop: string
  label: string
  display: string
}

export type FilterShortcut = {
  label: string
  value: string | number | DateRangeValue | NumberRangeValue
}

export type EfficiencyRow = {
  user_id?: string
  user_name?: string
  start_time?: string
  end_time?: string
  lead_time_ms?: number
  process_time_ms?: number
} & Record<string, unknown>

export type KanbanColumn<Row extends EfficiencyRow = EfficiencyRow> = {
  prop: string
  label: string
  width?: number | string
  minWidth?: number | string
  align?: "left" | "center" | "right"
  slotName?: string
  display?: (row: Row) => string
  render?: (row: Row) => JSX.Element
  sortable?: boolean
  showOverflowTooltip?: boolean
  filter?: {
    type: FilterType
    options?: FilterOption[]
    shortcuts?: FilterShortcut[]
    serverSide?: boolean
    placeholder?: string
    valueGetter?: (row: Row) => unknown
  }
}

export type EfficiencySummary = {
  dimension: EfficiencyDimension
  dimension_id: string
  analysis_date?: string
  ai_estimated: {
    raw_days: number
    corrected_days?: number | null
    is_corrected: boolean
    reasons: string[]
  }
  actual_time: {
    total_lead_time_ms: number
    total_process_time_ms: number
    total_code_lines: number
    user_count: number
    start_time?: string
    end_time?: string
    users: EfficiencyRow[]
  }
  efficiency: {
    ratio_lead: number
    ratio_process: number
    reason?: string
  }
  cost: {
    api_cost: number
    daily_rate: number
    cost_saving: number
    roi: number
  }
  analysis_file?: string
}

export type EfficiencyQuery = {
  dimension: EfficiencyDimension
  dimensionId: string
  dateRange: DateRangeValue
  page?: number
  pageSize?: number
  filters?: FilterValueMap
}

export type EfficiencyQueryResult = {
  rows: EfficiencyRow[]
  total: number
  summary?: EfficiencySummary
}

export type RepoAggregateRow = EfficiencyRow & {
  repo_addr?: string
  repo_branch?: string
  commit_count?: number
  task_count?: number
  sum_ancient_minutes?: number
  sum_real_minutes?: number
  efficiency_ratio?: number
  start_time?: string
  end_time?: string
}

export type RepoListQuery = {
  dateRange: DateRangeValue
  page?: number
  pageSize?: number
}

export type RepoListResult = {
  rows: RepoAggregateRow[]
  total: number
  page: number
  pageSize: number
}

export type RepoCommitRow = EfficiencyRow & {
  commit_id?: string
  commit_time?: string
  git_user_name?: string
  comment?: string
  diff_lines?: number
  commit_real_minutes?: number | null
  commit_real_minutes_manual?: number | null
  commit_ancient_minutes?: number | null
  commit_ancient_minutes_manual?: number | null
  silica?: number | null
  cost?: number | null
  upstream_tokens?: number
  downstream_tokens?: number
}

export type RepoTaskRow = EfficiencyRow & {
  task_id?: string
  start_time?: string
  user_name?: string
  title?: string
  diff_lines?: number
  task_real_minutes?: number | null
  task_real_minutes_manual?: number | null
  task_ancient_minutes?: number | null
  task_ancient_minutes_manual?: number | null
  cost?: number | null
  upstream_tokens?: number
  downstream_tokens?: number
}

export type RepoEfficiency = {
  repo_ancient_minutes?: number
  repo_real_minutes?: number
  efficiency_ratio?: number | null
  repo_ancient_minutes_reason?: string
  repo_real_minutes_reason?: string
}

export type RepoSummary = {
  commit_count?: number
  task_count?: number
}

export type RepoDetailResult = {
  repo_addr: string
  repo_branch?: string
  branches: string[]
  commits: RepoCommitRow[]
  tasks: RepoTaskRow[]
  efficiency: RepoEfficiency
  summary: RepoSummary
}

export type RepoDetailQuery = {
  repoAddr: string
  repoBranch?: string
  dateRange?: DateRangeValue
}

export type ProjectOption = {
  project_id: string
  name: string
  description?: string
}

export type ProjectConflict = {
  commit_id: string
  project_id: string
  project_name: string
}

export type RepoBindingPayload = {
  repo_addr: string
  repo_branch?: string
  start_time?: string | null
  end_time?: string | null
  exclude_commits?: string[]
  include_only_commits?: string[]
}

export type CorrectionPayload = {
  dimension: EfficiencyDimension
  dimensionId: string
  startDate: DateValue
  endDate: DateValue
  value: number
  reason: string
  operator: string
  field?: "ai_estimated_days"
}

export type CorrectionHistoryItem = {
  field_name?: string
  old_value?: string
  new_value?: string
  reason?: string
  corrected_by?: string
  corrected_at?: string
}

export type KanbanError = {
  code?: number
  message: string
  raw?: unknown
}

export type OrgListQuery = {
  level: OrgLevel
  parent?: string
  dateRange?: DateRangeValue
}

export type DimensionKeysQuery = {
  dimension: string
  dateRange?: DateRangeValue
}

export type Verb = "GET" | "POST" | "PUT" | "DELETE"

export type FetchOpts = {
  method?: Verb
  params?: Shape
  data?: Data
  timeout?: number
}