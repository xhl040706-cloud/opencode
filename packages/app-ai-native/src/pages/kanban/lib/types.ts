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
  sortField?: string
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

export type DashboardSummary = {
  total_users: number
  total_repos: number
  total_commits: number
  total_diff_lines: number
  // V2 派生字段（后端 dashboard_handler_v2 补充；比率为小数口径，前端 ×100 显示）
  total_branchs?: number
  total_commit_lines?: number
  total_users_v2?: number
  total_needs?: number
  merged_needs?: number
  eligible_needs?: number
  need_actual_calendar_min?: number
  need_baseline_calendar_min?: number
  need_calendar_ratio?: number | null
  need_work_ratio?: number | null
}

export type DashboardSummaryQuery = {
  dateRange?: DateRangeValue
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
  order?: string
}

export type RepoListResult = {
  rows: RepoAggregateRow[]
  total: number
  page: number
  pageSize: number
}

export type Granularity = "day" | "week" | "month" | "year"

export type UserAggregateRow = EfficiencyRow & {
  org1?: string
  org2?: string
  org3?: string
  org4?: string
  org_display?: string
  // V2 需求/日历/工作量维度（数据源 user_productivity_v2，比率为小数口径，前端 ×100 显示）
  week_count?: number
  merged_need_count?: number
  active_need_count?: number
  abandoned_need_count?: number
  actual_calendar_min?: number | null
  baseline_calendar_min?: number | null
  calendar_ratio?: number | null
  actual_work_min?: number | null
  baseline_work_min?: number | null
  work_ratio?: number | null
  commit_count?: number
  commit_diff_lines?: number
  tokens?: number
  confidence_limited?: boolean
  confidence_reason?: string
  // V1 兼容字段（user-groups 等老接口仍返回，保留以免编译断裂）
  task_count?: number
  task_diff_lines?: number
  task_real_minutes?: number | null
  commit_real_minutes?: number | null
  task_ancient_minutes?: number | null
  commit_ancient_minutes?: number | null
  task_efficiency_ratio?: number | null
  commit_efficiency_ratio?: number | null
  upstream_tokens?: number
  downstream_tokens?: number
  cost?: number | null
}

export type UserListQuery = {
  dateRange: DateRangeValue
  page?: number
  pageSize?: number
  granularity?: Granularity
  org?: OrgCascadeValue
  order?: string
}

// V2 用户列表无时间序列（native handler 不返回 periods/series）。
export type UserListResult = {
  rows: UserAggregateRow[]
  total: number
  page: number
  pageSize: number
}

// V2 用户详情汇总（数据源 user_productivity_v2，比率为小数口径）
export type UserDetailSummary = {
  user_id?: string
  user_name?: string
  week_count?: number
  merged_need_count?: number
  active_need_count?: number
  abandoned_need_count?: number
  actual_calendar_min?: number | null
  baseline_calendar_min?: number | null
  calendar_ratio?: number | null
  actual_work_min?: number | null
  baseline_work_min?: number | null
  work_ratio?: number | null
  commit_count?: number
  commit_diff_lines?: number
  tokens?: number
  cost?: number | null
  confidence_limited?: boolean
  confidence_reason?: string
}

// V2 用户周明细（user_productivity_v2 每周一行）
export type UserWeekRow = {
  week_start?: string
  merged_need_count?: number
  active_need_count?: number
  abandoned_need_count?: number
  actual_calendar_min?: number | null
  baseline_calendar_min?: number | null
  efficiency_ratio?: number | null
  actual_active_work_corrected_min?: number | null
  baseline_fused_work_min?: number | null
  work_efficiency_ratio?: number | null
  confidence_limited?: boolean
  confidence_reason?: string
  commit_count?: number
  commit_diff_lines?: number
}

// V2 用户详情中的 commit 行（来自 commits 表）
export type UserDetailCommitRow = {
  commit_id?: string
  commit_time?: string
  repo_addr?: string
  repo_branch?: string
  diff_lines?: number | null
  comment?: string
}

export type UserDetailQuery = {
  userId: string
  dateRange: DateRangeValue
  granularity?: Granularity
}

export type UserDetailResult = {
  summary: UserDetailSummary
  weeks: UserWeekRow[]
  needs: NeedRow[]
  commits: UserDetailCommitRow[]
}

export type UserOption = {
  user_id: string
  user_name?: string
}

export type UserGroupInfo = {
  id?: string
  name?: string
}

export type UserGroupMemberRow = UserAggregateRow & {
  day_count?: number
}

export type UserGroupSummary = {
  task_count?: number
  commit_count?: number
  task_efficiency_ratio?: number | null
  commit_efficiency_ratio?: number | null
  cost?: number | null
}

export type UserGroupDetailResult = {
  group: UserGroupInfo
  summary: UserGroupSummary
  members: UserGroupMemberRow[]
}

export type TaskRow = EfficiencyRow & {
  task_id?: string
  client_id?: string
  client_ide?: string
  client_version?: string
  client_os?: string
  client_os_version?: string
  caller?: string
  org1?: string
  org2?: string
  org3?: string
  org4?: string
  org_display?: string
  repo_addr?: string
  repo_branch?: string
  work_dir?: string
  work_dir_id?: string
  workDirId?: string
  title?: string
  diff_lines?: number
  task_real_minutes?: number | null
  task_real_minutes_manual?: number | null
  task_real_minutes_reason?: string | null
  task_real_minutes_reason_manual?: string | null
  task_ancient_minutes?: number | null
  task_ancient_minutes_manual?: number | null
  task_ancient_minutes_reason?: string | null
  task_ancient_minutes_reason_manual?: string | null
  efficiency_ratio?: number | null
  upstream_tokens?: number
  downstream_tokens?: number
  cost?: number | null
}

export type TaskConversation = {
  start_time?: string
  end_time?: string
  process_time?: number | null
  process_ttft?: number | null
  prompt_mode?: string
  mode?: string
  model?: string
  error_code?: string
  error_reason?: string
  upstream_tokens?: number
  downstream_tokens?: number
  cost?: number | null
  diff_lines?: number
  user_input?: string
  output?: string
}

export type TimeSegment = {
  start?: string
  end?: string
  conv_count?: number
}

export type TaskDetailResult = {
  task: TaskRow
  conversations: TaskConversation[]
  time_segments: TimeSegment[]
  efficiency_ratio?: number | null
}

export type TaskManualPayload = {
  task_real_minutes_manual?: number | null
  task_real_minutes_reason_manual?: string
  task_ancient_minutes_manual?: number | null
  task_ancient_minutes_reason_manual?: string
}

export type TaskListQuery = {
  dateRange: DateRangeValue
  page?: number
  pageSize?: number
  userId?: string
  org?: OrgCascadeValue
  repoAddr?: string
  repoBranch?: string
  order?: string
}

export type TaskListResult = {
  rows: TaskRow[]
  total: number
  page: number
  pageSize: number
}

export type CommitRow = EfficiencyRow & {
  commit_id?: string
  commit_time?: string
  git_user_name?: string
  git_user_email?: string
  org1?: string
  org2?: string
  org3?: string
  org4?: string
  org_display?: string
  comment?: string
  repo_addr?: string
  repo_branch?: string
  diff_lines?: number
  commit_real_minutes?: number | null
  commit_real_minutes_manual?: number | null
  commit_real_minutes_reason?: string | null
  commit_real_minutes_reason_manual?: string | null
  commit_real_ai_minutes?: number | null
  commit_real_ancient_minutes?: number | null
  commit_ancient_minutes?: number | null
  commit_ancient_minutes_manual?: number | null
  commit_ancient_minutes_reason?: string | null
  commit_ancient_minutes_reason_manual?: string | null
  efficiency_ratio?: number | null
  upstream_tokens?: number
  downstream_tokens?: number
  cost?: number | null
  silica?: number | null
}

export type CommitRelatedTask = {
  task_id?: string
  user_name?: string
  start_time?: string
  task_real_minutes?: number | null
  silica?: number | null
  cost?: number | null
  diff_lines?: number
}

export type CommitDetailResult = {
  commit: CommitRow
  related_tasks: CommitRelatedTask[]
  efficiency_ratio?: number | null
  silica?: number | null
  total_cost?: number | null
  upstream_tokens?: number
  downstream_tokens?: number
}

export type CommitManualPayload = {
  commit_ancient_minutes_manual?: number | null
  commit_ancient_minutes_reason_manual?: string
  commit_real_minutes_manual?: number | null
  commit_real_minutes_reason_manual?: string
}

export type CommitListQuery = {
  dateRange: DateRangeValue
  page?: number
  pageSize?: number
  userId?: string
  org?: OrgCascadeValue
  repoAddr?: string
  repoBranch?: string
  order?: string
}

export type CommitListResult = {
  rows: CommitRow[]
  total: number
  page: number
  pageSize: number
}

export type OrgDetailQuery = {
  dateRange: DateRangeValue
  granularity?: Granularity
  org: OrgCascadeValue
}

// V2 组织聚合行（数据源 user_productivity_v2，比率为小数口径）
export type OrgAggregateRow = {
  org_name?: string
  user_count?: number
  merged_need_count?: number
  actual_calendar_min?: number | null
  baseline_calendar_min?: number | null
  calendar_ratio?: number | null
  work_ratio?: number | null
  commit_count?: number
  commit_diff_lines?: number
  cost?: number | null
}

export type OrgAggregateQuery = {
  dateRange: DateRangeValue
  granularity?: Granularity
  org?: OrgCascadeValue
  order?: string
}

// V2 org 列表无时间序列（native handler 不返回 periods/series）
export type OrgAggregateResult = {
  rows: OrgAggregateRow[]
}

// V2 组织详情汇总（需求/日历/工作量维度，比率为小数口径）
export type OrgSummary = {
  user_count?: number
  merged_need_count?: number
  actual_calendar_min?: number | null
  baseline_calendar_min?: number | null
  calendar_ratio?: number | null
  actual_work_min?: number | null
  baseline_work_min?: number | null
  work_ratio?: number | null
  commit_count?: number
  commit_diff_lines?: number
  cost?: number | null
}

// V2 组织详情：成员复用 UserAggregateRow（含 V2 字段），无时间序列。
export type OrgDetailResult = {
  summary: OrgSummary
  members: UserAggregateRow[]
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
  efficiency_ratio: number | null
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

export type TaskProjectBindingPayload = {
  task_ids: string[]
  task_ids_silica: number[]
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
  order?: string
}

export type DimensionKeysQuery = {
  dimension: string
  dateRange?: DateRangeValue
}

export type WorkDirMatchedTask = {
  task_id?: string
  user_name?: string
  silica?: number | null
}

export type WorkDirCommitRow = RepoCommitRow & {
  silica_reason?: string
  matched_tasks?: WorkDirMatchedTask[]
}

export type WorkDirSummary = RepoSummary & {
  user_count?: number
  total_cost?: number | null
  task_ancient_minutes?: number | null
}

export type WorkDirSilicaEntry = {
  task_id?: string
  silica?: number | null
}

export type WorkDirParticipant = {
  user_id: string
  user_name: string
  task_count: number
  commit_count: number
}

export type WorkDirDetailResult = {
  repo_addr?: string
  repo_id?: string
  repo_branch?: string
  summary: WorkDirSummary
  commits: WorkDirCommitRow[]
  tasks: RepoTaskRow[]
  silica_entries: WorkDirSilicaEntry[]
}

export type ProjectRow = {
  project_id?: string
  name?: string
  description?: string
  start_time?: string
  start_time_manual?: string
  end_time?: string
  end_time_manual?: string
  user_count?: number
  repo_count?: number
  task_count?: number
  total_code_lines?: number
  actual_lines_per_day?: number
  cost?: number
  project_real_lead_minutes?: number
  project_real_lead_minutes_manual?: number
  project_ancient_minutes?: number
  project_ancient_minutes_manual?: number
  project_real_process_minutes?: number
  project_real_process_minutes_manual?: number
  efficiency_ratio?: number | null
}

export type ProjectListQuery = {
  order?: string
}

export type ProjectCreatePayload = {
  name: string
  description?: string
}

export type ProjectRepoRow = {
  repo_addr?: string
  repo_branch?: string
  start_time?: string
  end_time?: string
  exclude_commits?: string[]
  include_only_commits?: string[]
}

export type ProjectTaskRow = TaskRow & {
  silica?: number | null
}

export type ProjectCommitRow = {
  commit_id?: string
  user_name?: string
  commit_time?: string
  comment?: string
  diff_lines?: number
  commit_ancient_minutes?: number | null
  commit_ancient_minutes_manual?: number | null
  commit_real_minutes?: number | null
  commit_real_minutes_manual?: number | null
  silica?: number | null
  cost?: number | null
}

export type ProjectUserStat = {
  user_name: string
  task_count: number
  commit_count: number
  commit_diff_lines: number
  task_ancient_minutes: number
  task_real_minutes: number
  commit_ancient_minutes: number
  commit_real_minutes: number
  cost: number
  task_efficiency_ratio: number
  commit_efficiency_ratio: number
}

export type ProjectDetailResult = {
  project_id?: string
  name?: string
  description?: string
  start_time?: string
  start_time_manual?: string
  end_time?: string
  end_time_manual?: string
  upstream_tokens?: number
  downstream_tokens?: number
  cost?: number | null
  project_ancient_minutes?: number | null
  project_ancient_minutes_manual?: number | null
  project_ancient_minutes_reason?: string
  project_ancient_minutes_reason_manual?: string
  project_real_process_minutes?: number | null
  project_real_process_minutes_manual?: number | null
  project_real_process_minutes_reason?: string
  project_real_process_minutes_reason_manual?: string
  project_real_lead_minutes?: number | null
  project_real_lead_minutes_manual?: number | null
  project_real_lead_minutes_reason?: string
  project_real_lead_minutes_reason_manual?: string
  repos: ProjectRepoRow[]
  tasks: ProjectTaskRow[]
  commits: ProjectCommitRow[]
  members?: UserAggregateRow[]
  user_count: number
}

export type ProjectManualPayload = {
  project_ancient_minutes_manual?: number | null
  project_ancient_minutes_reason_manual?: string
  project_real_process_minutes_manual?: number | null
  project_real_process_minutes_reason_manual?: string
  project_real_lead_minutes_manual?: number | null
  project_real_lead_minutes_reason_manual?: string
  start_time_manual?: string | null
  end_time_manual?: string | null
}

export type ProjectUpdatePayload = {
  name: string
  description?: string
  repos?: ProjectRepoRow[]
  task_ids?: string[]
  task_ids_silica?: number[]
}

export type GlobalConfig = {
  traditional_dev_lines_per_day?: number
}

// ===== Need (V2 需求维度) =====
// 提效比为小数口径（如 0.136 => 13.6%），前端用 formatV2Ratio ×100 显示。
export type NeedRow = EfficiencyRow & {
  need_id?: string
  status?: string
  boundary_source?: string
  boundary_confidence?: string
  repo_addr?: string
  repo_branch?: string
  primary_user_id?: string
  dev_start_ts?: string
  dev_end_ts?: string
  merge_ts?: string | null
  total_calendar_min?: number | null
  baseline_calendar_min?: number | null
  total_active_work_corrected_min?: number | null
  baseline_fused_work_min?: number | null
  efficiency_ratio?: number | null
  efficiency_band_low?: number | null
  efficiency_band_high?: number | null
  work_efficiency_ratio?: number | null
  confidence_level?: string
  outlier_flag?: boolean
  coverage_eligible?: boolean
  total_think_min?: number | null
  total_exec_min?: number | null
  total_verify_min?: number | null
  reason?: string
}

export type NeedListQuery = {
  dateRange: DateRangeValue
  page?: number
  pageSize?: number
  repoAddr?: string
  repoBranch?: string
  userId?: string
  status?: string
  boundarySource?: string
  boundaryConfidence?: string
  confidenceLevel?: string
  outlierOnly?: boolean
  includeAll?: boolean
}

export type NeedListResult = {
  rows: NeedRow[]
  total: number
  page: number
  pageSize: number
}

// Need 详情中的 need 对象比列表行更完整，含基础信息 + 质量信号字段。
export type NeedDetailNeed = NeedRow & {
  boundary_key?: string
  contributor_user_ids?: string[]
  touched_files?: string[]
  dev_duration_min?: number | null
  wait_for_review_min?: number | null
  total_session_active_person_min?: number | null
  estimate_uncovered_human_min?: number | null
  total_other_min?: number | null
  team_profile_used?: string
  commit_count?: number | null
  total_loc_net?: number | null
  total_files_touched?: number | null
  ai_covered_loc?: number | null
  uncovered_loc?: number | null
  uncovered_work_ratio?: number | null
  ai_code_ratio?: number | null
  silica?: number | null
}

export type NeedSessionRow = {
  session_id?: string
  user_id?: string
  session_start_ts?: string
  session_end_ts?: string
  total_active_min?: number | null
  think_active_min?: number | null
  exec_active_min?: number | null
  verify_active_min?: number | null
  stage_confidence?: string
  summary?: string
}

export type NeedCommitRow = {
  commit_id?: string
  commit_time?: string
  user_name?: string
  user_id?: string
  diff_lines?: number | null
  silica?: number | null
  comment?: string
  touched_files?: string[]
}

// Need 详情·基线组成（baseline_components）：解释"提效基线怎么算出来"。
// 分钟口径；null 表示该来源未参与。
export type NeedBaselineComponents = {
  algo_think_min?: number | null
  algo_exec_min?: number | null
  algo_verify_min?: number | null
  algo_total_min?: number | null
  anchor_knn_min?: number | null
  anchor_knn_reason?: string
  llm_think_min?: number | null
  llm_exec_min?: number | null
  llm_verify_min?: number | null
  llm_total_min?: number | null
  llm_confidence?: string
  llm_reason?: string
  fused_work_min?: number | null
  spread_work_min?: number | null
  calendar_min?: number | null
  team_work_density?: number | null
}

export type NeedDetailResult = {
  need: NeedDetailNeed
  sessions: NeedSessionRow[]
  commits: NeedCommitRow[]
  baselineComponents: NeedBaselineComponents
}

export type Verb = "GET" | "POST" | "PUT" | "DELETE"

export type FetchOpts = {
  method?: Verb
  params?: Shape
  data?: Data
  timeout?: number
}
