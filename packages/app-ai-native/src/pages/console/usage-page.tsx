/**
 * Usage Statistics Page - migrated from zgsm-admin-system
 * Called by: routes.tsx (new route /console/usage), pages/console/index.ts (export)
 * No existing file serves the same purpose (this is a new page for credit/quota usage)
 * Reads API data from /quota-manager/api/v1/quota and /quota-manager/api/v1/usage/statistics
 * Date format: YYYY-MM-DD HH:mm:ss for API params, YYYY-MM-DD HH:mm for display
 */

import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Icon } from "@opencode-ai/ui/icon"
import { useLanguage } from "@/context/language"
import { useAuth } from "@/pages/store/hooks/use-auth"
import { getLoginUrl } from "@/pages/store/lib/auth"
import { Button } from "@/components/ui/button"
import { sx, st } from "@/pages/store/lib/styles"
import { DateRangePicker } from "@/pages/kanban/components/filters/date-range-picker"
import { getUserQuota, getUsageStatistics } from "./lib/quota-api"
import type { QuotaList, UsageConsumptionRecord } from "./lib/quota-api"
import type { DateRangeValue } from "@/pages/kanban/lib/types"

function formatDate(dateInput: string, formatStr = "YYYY-MM-DD HH:mm:ss"): string {
  if (!dateInput) return ""
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return formatStr
    .replace("YYYY", String(date.getFullYear()))
    .replace("MM", pad(date.getMonth() + 1))
    .replace("DD", pad(date.getDate()))
    .replace("HH", pad(date.getHours()))
    .replace("mm", pad(date.getMinutes()))
    .replace("ss", pad(date.getSeconds()))
}

function formatNumber(num: number): string {
  return num.toFixed(2)
}

function rangePages(page: number, totalPages: number): number[] {
  const size = 5
  if (totalPages <= size) return Array.from({ length: totalPages }, (_, i) => i + 1)
  const start = Math.max(1, Math.min(page - 2, totalPages - size + 1))
  return Array.from({ length: size }, (_, i) => start + i)
}

function ProgressBar(props: { percentage: number }) {
  const clamped = () => Math.max(0, Math.min(100, props.percentage))
  return (
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--native-border)_30%,transparent)]">
      <div
        class="h-full rounded-full transition-all duration-500"
        style={{
          width: `${clamped()}%`,
          background: "linear-gradient(90deg, rgba(0,102,255,0.7), rgba(0,255,183,0.7))",
        }}
      />
    </div>
  )
}

function UsageTable(props: {
  records: UsageConsumptionRecord[]
  loading: boolean
  initialLoad: boolean
}) {
  const language = useLanguage()

  return (
    <div class={sx.tshell}>
      <table class={sx.dtStatic}>
        <thead>
          <tr>
            <th class={sx.th}>{language.t("console.usage.table.startTime")}</th>
            <th class={sx.th}>{language.t("console.usage.table.model")}</th>
            <th class={sx.th}>{language.t("console.usage.table.mode")}</th>
            <th class={sx.th}>{language.t("console.usage.table.creditsUsed")}</th>
            <th class={sx.th}>{language.t("console.usage.table.package")}</th>
          </tr>
        </thead>
        <tbody>
          <Show
            when={!props.initialLoad || !props.loading}
            fallback={
              <tr>
                <td colSpan={5} class={sx.state}>
                  <div class={sx.spinner} />
                </td>
              </tr>
            }
          >
            <Show
              when={props.records.length > 0}
              fallback={
                <tr>
                  <td colSpan={5} class={sx.state}>
                    {language.t("console.usage.table.empty")}
                  </td>
                </tr>
              }
            >
              <For each={props.records}>
                {(row) => (
                  <tr>
                    <td class={sx.td}>{formatDate(row.record_time, "YYYY-MM-DD HH:mm")}</td>
                    <td class={sx.td}>{row.model || "-"}</td>
                    <td class={sx.td}>{row.mode || "-"}</td>
                    <td class={sx.td}>{row.credits_used ?? "-"}</td>
                    <td class={sx.td}>{row.package || "-"}</td>
                  </tr>
                )}
              </For>
            </Show>
          </Show>
        </tbody>
      </table>
    </div>
  )
}

function QuotaValidityTable(props: { data: QuotaList[] }) {
  const language = useLanguage()
  const [page, setPage] = createSignal(1)
  const [pageSize, setPageSize] = createSignal(3)
  const totalPages = () => Math.ceil(props.data.length / pageSize())
  const displayData = () => {
    const start = (page() - 1) * pageSize()
    return props.data.slice(start, start + pageSize())
  }
  const visiblePages = () => rangePages(page(), totalPages())
  const pageSizeOptions = [3, 5, 10]

  return (
    <>
      <div class={sx.tshell}>
        <table class={sx.dtStatic}>
          <thead>
            <tr>
              <th class={sx.th}>{language.t("console.usage.quota.expiryDate")}</th>
              <th class={sx.th}>{language.t("console.usage.quota.amount")}</th>
              <th class={sx.th}>{language.t("console.usage.quota.source")}</th>
            </tr>
          </thead>
          <tbody>
            <Show
              when={props.data.length > 0}
              fallback={
                <tr>
                  <td colSpan={3} class={sx.state}>
                    {language.t("console.usage.quota.empty")}
                  </td>
                </tr>
              }
            >
              <For each={displayData()}>
                {(row) => (
                  <tr>
                    <td class={sx.td}>{formatDate(row.expiry_date, "YYYY-MM-DD")}</td>
                    <td class={sx.td}>{formatNumber(row.amount)}</td>
                    <td class={sx.td}>{row.source || "-"}</td>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>
      <Show when={props.data.length > 0}>
        <div class={sx.pager}>
          <div class={sx.pagerSum}>
            {language.t("console.usage.pagination.summary", {
              from: String((page() - 1) * pageSize() + 1),
              to: String(Math.min(page() * pageSize(), props.data.length)),
              total: String(props.data.length),
            })}
          </div>
          <div class="flex items-center gap-3">
            <select
              class={sx.btn}
              value={pageSize()}
              onChange={(e) => {
                setPageSize(Number(e.currentTarget.value))
                setPage(1)
              }}
            >
              <For each={pageSizeOptions}>
                {(size) => <option value={size}>{size} / {language.t("console.usage.pagination.page")}</option>}
              </For>
            </select>
            <div class={sx.pagerActs}>
              <button class={st.page(false)} disabled={page() <= 1} onClick={() => setPage(1)}>
                <span aria-hidden="true">&#171;</span>
              </button>
              <button class={st.page(false)} disabled={page() <= 1} onClick={() => setPage((p) => p - 1)}>
                <Icon name="chevron-left" />
              </button>
              <For each={visiblePages()}>
                {(pageNumber) => (
                  <button class={st.page(pageNumber === page())} onClick={() => setPage(pageNumber)}>
                    {pageNumber}
                  </button>
                )}
              </For>
              <button class={st.page(false)} disabled={page() >= totalPages()} onClick={() => setPage((p) => p + 1)}>
                <Icon name="chevron-right" />
              </button>
              <button class={st.page(false)} disabled={page() >= totalPages()} onClick={() => setPage(totalPages())}>
                <span aria-hidden="true">&#187;</span>
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  )
}

function TablePagination(props: {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const language = useLanguage()
  const totalPages = () => Math.ceil((props.totalCount || 0) / (props.pageSize || 10))
  const visiblePages = () => rangePages(props.page, totalPages())
  const from = () => Math.min((props.page - 1) * props.pageSize + 1, props.totalCount)
  const to = () => Math.min(props.page * props.pageSize, props.totalCount)

  const pageSizeOptions = [10, 20, 50]

  return (
    <div class={sx.pager}>
      <div class={sx.pagerSum}>
        {props.totalCount > 0
          ? language.t("console.usage.pagination.summary", { from: String(from()), to: String(to()), total: String(props.totalCount) })
          : language.t("console.usage.pagination.empty")}
      </div>
      <div class="flex items-center gap-3">
        <select
          class={sx.btn}
          value={props.pageSize}
          onChange={(e) => props.onPageSizeChange(Number(e.currentTarget.value))}
        >
          <For each={pageSizeOptions}>
            {(size) => <option value={size}>{size} / {language.t("console.usage.pagination.page")}</option>}
          </For>
        </select>
        <div class={sx.pagerActs}>
          <button class={st.page(false)} disabled={props.page <= 1} onClick={() => props.onPageChange(1)}>
            <span aria-hidden="true">&#171;</span>
          </button>
          <button class={st.page(false)} disabled={props.page <= 1} onClick={() => props.onPageChange(props.page - 1)}>
            <Icon name="chevron-left" />
          </button>
          <For each={visiblePages()}>
            {(pageNumber) => (
              <button class={st.page(pageNumber === props.page)} onClick={() => props.onPageChange(pageNumber)}>
                {pageNumber}
              </button>
            )}
          </For>
          <button class={st.page(false)} disabled={props.page >= totalPages()} onClick={() => props.onPageChange(props.page + 1)}>
            <Icon name="chevron-right" />
          </button>
          <button class={st.page(false)} disabled={props.page >= totalPages()} onClick={() => props.onPageChange(totalPages())}>
            <span aria-hidden="true">&#187;</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsagePage() {
  const language = useLanguage()
  const { user, loading: authLoading } = useAuth()

  const [state, setState] = createStore({
    usedQuota: 0,
    totalQuota: 0,
    quotaList: [] as QuotaList[],
    isStar: undefined as string | undefined,

    usageRecords: [] as UsageConsumptionRecord[],
    usageLoading: false,
    usagePage: 1,
    usagePageSize: 10,
    usageTotal: 0,

    selectedTimeRange: "today" as string,
    customDateRange: null as DateRangeValue,

    loadingQuota: false,
    usageInitialLoad: true,
  })

  const percentage = createMemo(() => {
    if (state.totalQuota === 0) return 0
    return Number(((state.usedQuota / state.totalQuota) * 100).toFixed(0))
  })

  const remainingQuota = createMemo(() => state.totalQuota - state.usedQuota)

  const fetchUserQuota = async () => {
    setState("loadingQuota", true)
    try {
      const data = await getUserQuota()
      setState("usedQuota", data.used_quota ?? 0)
      setState("totalQuota", data.total_quota ?? 0)
      setState("quotaList", data.quota_list ?? [])
      setState("isStar", data.is_star)
    } catch (err) {
      console.error("Failed to fetch user quota:", err)
    } finally {
      setState("loadingQuota", false)
    }
  }

  const fetchUsageData = async () => {
    setState("usageLoading", true)
    try {
      const params: { page: number; page_size: number; time_range?: string; start_time?: string; end_time?: string } = {
        page: state.usagePage,
        page_size: state.usagePageSize,
      }

      if (state.selectedTimeRange && state.selectedTimeRange !== "custom") {
        params.time_range = state.selectedTimeRange
      } else if (state.selectedTimeRange === "custom" && state.customDateRange) {
        params.start_time = `${state.customDateRange[0]} 00:00:00`
        params.end_time = `${state.customDateRange[1]} 00:00:00`
      }

      const data = await getUsageStatistics(params)
      setState("usageRecords", data.records ?? [])
      setState("usageTotal", data.total ?? 0)
      setState("usageInitialLoad", false)

      if ((data.records ?? []).length === 0 && state.usagePage > 1) {
        setState("usagePage", 1)
      }
    } catch (err) {
      console.error("Failed to fetch usage statistics:", err)
      setState("usageRecords", [])
      setState("usageTotal", 0)
    } finally {
      setState("usageLoading", false)
    }
  }

  const handleTimeRangeSelect = (range: string) => {
    setState("selectedTimeRange", range)
    setState("customDateRange", null)
    setState("usagePage", 1)
  }

  const handleCustomDateChange = (value: DateRangeValue) => {
    if (value && value.length === 2) {
      setState("selectedTimeRange", "custom")
      setState("customDateRange", value)
      setState("usagePage", 1)
    } else if (!value) {
      setState("selectedTimeRange", "today")
      setState("customDateRange", null)
      setState("usagePage", 1)
    }
  }

  const handlePageChange = (page: number) => {
    setState("usagePage", page)
  }

  const handlePageSizeChange = (size: number) => {
    setState("usagePageSize", size)
    setState("usagePage", 1)
  }

  createEffect(() => {
    if (user()) {
      fetchUserQuota()
    }
  })

  createEffect(() => {
    if (user()) {
      fetchUsageData()
    }
  })

  const timeRangeButtons = [
    { key: "today", label: language.t("console.usage.filter.today") },
    { key: "7days", label: language.t("console.usage.filter.within7Days") },
    { key: "30days", label: language.t("console.usage.filter.within30Days") },
  ]

  return (
    <Show
      when={!authLoading()}
      fallback={<div class={sx.empty}>{language.t("common.loading")}</div>}
    >
      <Show
        when={user()}
        fallback={
          <div class="flex min-h-[40vh] items-center justify-center">
            <div style={{ "text-align": "center" }}>
              <h1 class={sx.toolbarTitle}>{language.t("console.usage.title")}</h1>
              <p class="mb-3 text-[0.8125rem] text-[var(--native-muted)]">{language.t("console.usage.loginRequired")}</p>
              <Button
                type="button"
                size="sm"
                onClick={() => { window.location.href = getLoginUrl() }}
              >
                {language.t("store.console.login")}
              </Button>
            </div>
          </div>
        }
      >
        <section class={`${sx.section} pb-8`}>
          {/* Quota Overview */}
          <div class={sx.toolbar}>
            <div>
              <h2 class={sx.toolbarTitle}>{language.t("console.usage.quotaOverview")}</h2>
              <p class={sx.toolbarSub}>{language.t("console.usage.quotaOverviewDesc")}</p>
            </div>
          </div>

          <div class={sx.cshell}>
            <Show
              when={!state.loadingQuota}
              fallback={
                <div class={sx.state}>
                  <div class={sx.spinner} />
                </div>
              }
            >
              <div class="space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-[0.8125rem] font-medium text-[var(--native-foreground)]">
                    {language.t("console.usage.usedQuota", { used: formatNumber(state.usedQuota), total: formatNumber(state.totalQuota) })}
                  </span>
                  <span class="text-[0.8125rem] text-[var(--native-muted)]">
                    {language.t("console.usage.remainingQuota", { remaining: formatNumber(remainingQuota()) })}
                  </span>
                </div>
                <ProgressBar percentage={percentage()} />

                {/* Quota Validity */}
                <div class="pt-2">
                  <h3 class="mb-2 text-[0.8125rem] font-semibold text-[var(--native-foreground)]">
                    {language.t("console.usage.quotaValidity")}
                  </h3>
                  <QuotaValidityTable data={state.quotaList} />
                </div>
              </div>
            </Show>
          </div>

          {/* Usage Consumption */}
          <div class="mt-6">
            <div class={sx.toolbar}>
              <div>
                <h2 class={sx.toolbarTitle}>{language.t("console.usage.consumptionTitle")}</h2>
                <p class={sx.toolbarSub}>{language.t("console.usage.consumptionDesc")}</p>
              </div>
            </div>

            <div class={sx.cshell}>
              {/* Time Range Filter */}
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <For each={timeRangeButtons}>
                  {(btn) => (
                    <button
                      type="button"
                      class={st.filter(state.selectedTimeRange === btn.key)}
                      onClick={() => handleTimeRangeSelect(btn.key)}
                    >
                      {btn.label}
                    </button>
                  )}
                </For>
                <DateRangePicker
                  value={state.customDateRange}
                  onChange={handleCustomDateChange}
                  clearable
                  placeholder={language.t("console.usage.filter.custom")}
                  size="sm"
                  fullWidth={false}
                />
              </div>

              {/* Usage Table */}
              <UsageTable records={state.usageRecords} loading={state.usageLoading} initialLoad={state.usageInitialLoad} />

              {/* Pagination */}
              <Show when={state.usageTotal > 0}>
                <TablePagination
                  page={state.usagePage}
                  pageSize={state.usagePageSize}
                  totalCount={state.usageTotal}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </Show>
            </div>
          </div>
        </section>
      </Show>
    </Show>
  )
}
