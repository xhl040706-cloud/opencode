import type {
  ProjectConflict,
  ProjectOption,
  RepoBindingPayload,
  RepoCommitRow,
  RepoDetailQuery,
  RepoDetailResult,
  RepoListQuery,
  RepoListResult,
  RepoTaskRow,
} from "../lib/types"

type Commit = RepoCommitRow & {
  repo_addr: string
  repo_branch: string
}

type Task = RepoTaskRow & {
  repo_addr: string
  repo_branch: string
}

const key = "kanban:repo:mock"

const projects = [
  {
    project_id: "mock-proj-kanban",
    name: "Kanban Migration Test",
    description: "For local testing of repo-v2 migration",
  },
  {
    project_id: "mock-proj-growth",
    name: "Growth Dashboard",
    description: "Observe high-efficiency repo behavior patterns",
  },
  {
    project_id: "mock-proj-infra",
    name: "Infrastructure Stability",
    description: "Focus on backend and infra repos",
  },
] satisfies ProjectOption[]

const commits: Commit[] = [
  {
    repo_addr: "github.com/Codium-ai/codium",
    repo_branch: "main",
    commit_id: "c0d1a8f4b2e19a3c",
    commit_time: "2026-04-20T09:12:00+08:00",
    git_user_name: "chenzj",
    comment: "migrate repo list to kanban table shell",
    diff_lines: 268,
    commit_real_minutes: 96,
    commit_ancient_minutes: 640,
    silica: 78.4,
    upstream_tokens: 42110,
    downstream_tokens: 11842,
  },
  {
    repo_addr: "github.com/Codium-ai/codium",
    repo_branch: "main",
    commit_id: "d41ab6720b754301",
    commit_time: "2026-04-19T15:38:00+08:00",
    git_user_name: "chenzj",
    comment: "align repo detail metrics and reason tooltips",
    diff_lines: 193,
    commit_real_minutes: 84,
    commit_ancient_minutes: 510,
    silica: 66.8,
    upstream_tokens: 28620,
    downstream_tokens: 9720,
  },
  {
    repo_addr: "github.com/Codium-ai/codium",
    repo_branch: "feat/repo-v2",
    commit_id: "e67209bfca31d4ae",
    commit_time: "2026-04-18T11:06:00+08:00",
    git_user_name: "molly",
    comment: "wire add-to-project dialog whitelist flow",
    diff_lines: 152,
    commit_real_minutes: 72,
    commit_ancient_minutes: 420,
    silica: 58.2,
    upstream_tokens: 19800,
    downstream_tokens: 6110,
  },
  {
    repo_addr: "github.com/Codium-ai/codium",
    repo_branch: "release/1.2",
    commit_id: "f81c4abe293f17b0",
    commit_time: "2026-04-12T16:44:00+08:00",
    git_user_name: "river",
    comment: "polish repo ratio pill thresholds",
    diff_lines: 84,
    commit_real_minutes: 45,
    commit_ancient_minutes: 210,
    silica: 41.6,
    upstream_tokens: 7440,
    downstream_tokens: 2388,
  },
  {
    repo_addr: "github.com/sangfor/cloud-console",
    repo_branch: "main",
    commit_id: "ab19c0de7f112233",
    commit_time: "2026-04-17T10:18:00+08:00",
    git_user_name: "jojo",
    comment: "refine issue workflow board interactions",
    diff_lines: 176,
    commit_real_minutes: 118,
    commit_ancient_minutes: 430,
    silica: 34.9,
    upstream_tokens: 16420,
    downstream_tokens: 4322,
  },
  {
    repo_addr: "github.com/sangfor/cloud-console",
    repo_branch: "main",
    commit_id: "ab19c0de7f445566",
    commit_time: "2026-04-11T14:28:00+08:00",
    git_user_name: "jojo",
    comment: "stabilize dashboard data cards and row states",
    diff_lines: 129,
    commit_real_minutes: 86,
    commit_ancient_minutes: 260,
    silica: 28.3,
    upstream_tokens: 13840,
    downstream_tokens: 3750,
  },
  {
    repo_addr: "gitlab.sangfor.com/infra/efficiency-backend",
    repo_branch: "main",
    commit_id: "9087cc11bbaaccdd",
    commit_time: "2026-04-15T20:15:00+08:00",
    git_user_name: "delta",
    comment: "optimize aggregate query and cache warmup",
    diff_lines: 221,
    commit_real_minutes: 210,
    commit_ancient_minutes: 590,
    silica: 22.4,
    upstream_tokens: 12680,
    downstream_tokens: 3080,
  },
  {
    repo_addr: "gitlab.sangfor.com/infra/efficiency-backend",
    repo_branch: "hotfix/sql-timeout",
    commit_id: "1357ee22ccdd4499",
    commit_time: "2026-04-08T09:50:00+08:00",
    git_user_name: "delta",
    comment: "reduce slow scan on repo detail endpoint",
    diff_lines: 97,
    commit_real_minutes: 102,
    commit_ancient_minutes: 245,
    silica: 17.1,
    upstream_tokens: 8880,
    downstream_tokens: 2110,
  },
] 

const tasks: Task[] = [
  {
    repo_addr: "github.com/Codium-ai/codium",
    repo_branch: "main",
    task_id: "TM4012A1",
    start_time: "2026-04-20T08:35:00+08:00",
    user_name: "chenzj",
    title: "Migrate repo list page to kanban",
    diff_lines: 268,
    task_real_minutes: 132,
    task_ancient_minutes: 760,
    cost: 18.6,
    upstream_tokens: 50220,
    downstream_tokens: 14120,
  },
  {
    repo_addr: "github.com/Codium-ai/codium",
    repo_branch: "main",
    task_id: "TM4018B2",
    start_time: "2026-04-19T13:10:00+08:00",
    user_name: "chenzj",
    title: "Complete repo detail metrics and table",
    diff_lines: 193,
    task_real_minutes: 108,
    task_ancient_minutes: 620,
    cost: 14.9,
    upstream_tokens: 36200,
    downstream_tokens: 10180,
  },
  {
    repo_addr: "github.com/Codium-ai/codium",
    repo_branch: "feat/repo-v2",
    task_id: "TF4030C3",
    start_time: "2026-04-18T09:40:00+08:00",
    user_name: "molly",
    title: "Add repo-project binding dialog",
    diff_lines: 152,
    task_real_minutes: 96,
    task_ancient_minutes: 540,
    cost: 11.7,
    upstream_tokens: 24120,
    downstream_tokens: 7420,
  },
  {
    repo_addr: "github.com/sangfor/cloud-console",
    repo_branch: "main",
    task_id: "SC3901D4",
    start_time: "2026-04-17T09:00:00+08:00",
    user_name: "jojo",
    title: "Polish operations dashboard interactions",
    diff_lines: 176,
    task_real_minutes: 148,
    task_ancient_minutes: 510,
    cost: 16.2,
    upstream_tokens: 22880,
    downstream_tokens: 6480,
  },
  {
    repo_addr: "gitlab.sangfor.com/infra/efficiency-backend",
    repo_branch: "main",
    task_id: "BE3880E5",
    start_time: "2026-04-15T18:00:00+08:00",
    user_name: "delta",
    title: "Optimize backend aggregation query",
    diff_lines: 221,
    task_real_minutes: 240,
    task_ancient_minutes: 660,
    cost: 19.8,
    upstream_tokens: 18210,
    downstream_tokens: 4310,
  },
]

const links = {
  c0d1a8f4b2e19a3c: { project_id: "mock-proj-growth", project_name: "Growth Dashboard" },
  e67209bfca31d4ae: { project_id: "mock-proj-kanban", project_name: "Kanban Migration Test" },
}

function day(v?: string | null) {
  if (!v) return ""
  const date = new Date(v)
  if (Number.isNaN(date.getTime())) return v.slice(0, 10)
  return date.toISOString().slice(0, 10)
}

function fit(v: string | null | undefined, range?: RepoListQuery["dateRange"]) {
  if (!range) return true
  const txt = day(v)
  if (!txt) return false
  return txt >= range[0] && txt <= range[1]
}

function ratio(ancient: number, real: number) {
  if (!ancient || !real || ancient <= 0 || real <= 0) return null
  return (ancient / real) * 100
}

function sum(list: number[]) {
  return list.reduce((acc, item) => acc + item, 0)
}

function uniq(list: string[]) {
  return Array.from(new Set(list.filter(Boolean)))
}

function branches(addr: string) {
  return uniq([
    ...commits.filter((item) => item.repo_addr === addr).map((item) => item.repo_branch),
    ...tasks.filter((item) => item.repo_addr === addr).map((item) => item.repo_branch),
  ]).sort()
}

function detail(input: RepoDetailQuery): RepoDetailResult {
  const addr = input.repoAddr.trim()
  const branch = input.repoBranch?.trim()
  const commitRows = commits
    .filter((item) => item.repo_addr === addr)
    .filter((item) => !branch || item.repo_branch === branch)
    .filter((item) => fit(item.commit_time, input.dateRange))
    .sort((a, b) => (b.commit_time ?? "").localeCompare(a.commit_time ?? ""))

  const taskRows = tasks
    .filter((item) => item.repo_addr === addr)
    .filter((item) => !branch || item.repo_branch === branch)
    .filter((item) => fit(item.start_time, input.dateRange))
    .sort((a, b) => (b.start_time ?? "").localeCompare(a.start_time ?? ""))

  const ancient = sum([
    ...commitRows.map((item) => item.commit_ancient_minutes_manual ?? item.commit_ancient_minutes ?? 0),
    ...taskRows.map((item) => item.task_ancient_minutes_manual ?? item.task_ancient_minutes ?? 0),
  ])
  const real = sum([
    ...commitRows.map((item) => item.commit_real_minutes_manual ?? item.commit_real_minutes ?? 0),
    ...taskRows.map((item) => item.task_real_minutes_manual ?? item.task_real_minutes ?? 0),
  ])

  return {
    repo_addr: addr,
    repo_branch: branch,
    branches: branches(addr),
    commits: commitRows,
    tasks: taskRows,
    efficiency: {
      repo_ancient_minutes: ancient,
      repo_real_minutes: real,
      efficiency_ratio: ratio(ancient, real),
      repo_ancient_minutes_reason: `Mock aggregated from ${commitRows.length} commits and ${taskRows.length} tasks for local visual comparison.`,
      repo_real_minutes_reason: `Mock data intentionally preserves time, tokens, cost, and branch differences for validating detail page cards and table layout.`,
    },
    summary: {
      commit_count: commitRows.length,
      task_count: taskRows.length,
    },
  }
}

export function repoMock() {
  if (!import.meta.env.DEV || typeof window === "undefined") return false
  const query = new URLSearchParams(window.location.search)
  const flag = query.get("mock")?.trim()
  if (flag === "1" || flag === "repo") return true
  return typeof localStorage !== "undefined" && localStorage.getItem(key) === "1"
}

export function queryRepoRowsMock(input: RepoListQuery): RepoListResult {
  const map = new Map<string, {
    repo_addr: string
    repo_branch: string
    commit_count: number
    task_count: number
    sum_ancient_minutes: number
    sum_real_minutes: number
    start_time?: string
    end_time?: string
  }>()

  for (const item of commits.filter((row) => fit(row.commit_time, input.dateRange))) {
    const id = `${item.repo_addr}::${item.repo_branch}`
    const row = map.get(id) ?? {
      repo_addr: item.repo_addr,
      repo_branch: item.repo_branch,
      commit_count: 0,
      task_count: 0,
      sum_ancient_minutes: 0,
      sum_real_minutes: 0,
      start_time: item.commit_time,
      end_time: item.commit_time,
    }
    row.commit_count += 1
    row.sum_ancient_minutes += item.commit_ancient_minutes_manual ?? item.commit_ancient_minutes ?? 0
    row.sum_real_minutes += item.commit_real_minutes_manual ?? item.commit_real_minutes ?? 0
    row.start_time = !row.start_time || (item.commit_time ?? "") < row.start_time ? item.commit_time : row.start_time
    row.end_time = !row.end_time || (item.commit_time ?? "") > row.end_time ? item.commit_time : row.end_time
    map.set(id, row)
  }

  for (const item of tasks.filter((row) => fit(row.start_time, input.dateRange))) {
    const id = `${item.repo_addr}::${item.repo_branch}`
    const row = map.get(id) ?? {
      repo_addr: item.repo_addr,
      repo_branch: item.repo_branch,
      commit_count: 0,
      task_count: 0,
      sum_ancient_minutes: 0,
      sum_real_minutes: 0,
      start_time: item.start_time,
      end_time: item.start_time,
    }
    row.task_count += 1
    row.sum_ancient_minutes += item.task_ancient_minutes_manual ?? item.task_ancient_minutes ?? 0
    row.sum_real_minutes += item.task_real_minutes_manual ?? item.task_real_minutes ?? 0
    row.start_time = !row.start_time || (item.start_time ?? "") < row.start_time ? item.start_time : row.start_time
    row.end_time = !row.end_time || (item.start_time ?? "") > row.end_time ? item.start_time : row.end_time
    map.set(id, row)
  }

  const rows = Array.from(map.values())
    .map((item) => ({
      ...item,
      efficiency_ratio: ratio(item.sum_ancient_minutes, item.sum_real_minutes) ?? 0,
    }))
    .sort((a, b) => (b.end_time ?? "").localeCompare(a.end_time ?? ""))

  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 250
  const start = Math.max(page - 1, 0) * pageSize

  return {
    rows: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize,
  }
}

export function getRepoDetailMock(input: RepoDetailQuery) {
  return detail(input)
}

export function listRepoBranchesMock(addr: string) {
  return branches(addr.trim())
}

export function loadProjectOptionsMock() {
  return [...projects]
}

export function createProjectOptionMock(input: { name: string; description?: string }) {
  return {
    project_id: `mock-${input.name.trim().toLowerCase().replace(/\s+/g, "-") || "project"}`,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
  } satisfies ProjectOption
}

export function checkProjectConflictsMock(ids: string[]) {
  return ids
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => {
      const hit = links[item as keyof typeof links]
      if (!hit) return []
      return [{
        commit_id: item,
        project_id: hit.project_id,
        project_name: hit.project_name,
      } satisfies ProjectConflict]
    })
}

export function addRepoToProjectMock(projectId: string, payload: RepoBindingPayload) {
  return {
    ok: true,
    project_id: projectId.trim(),
    repo_addr: payload.repo_addr.trim(),
    repo_branch: payload.repo_branch?.trim() || "",
  }
}