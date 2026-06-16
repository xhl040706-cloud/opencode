export const table = {
  tableShell: "relative overflow-hidden rounded-[0.375rem] border border-[color:color-mix(in_oklab,var(--native-border)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_76%,var(--native-bg-subtle))]",
  state: "px-4 py-12 text-center text-[var(--native-muted)]",
  // ─── 三态可区分视觉编码（T2-7）：error 警示色+图标+重试按钮 / empty 中性图标+引导 / loading 区别呈现 ───
  // 通用容器：纵向居中、留白与原 `state` 对齐，子元素之间留间距。
  stateBox: "flex flex-col items-center justify-center gap-3 px-4 py-12 text-center",
  // error：警示色文案；图标用 warning 配 #dc2626（与确认弹窗一致）。
  stateError: "text-sm font-medium text-[#dc2626]",
  stateErrorIcon: "text-[#dc2626]",
  // empty：中性图标 + 弱化引导文案。
  stateEmpty: "text-sm text-[var(--native-muted)]",
  stateEmptyIcon: "text-[color:color-mix(in_srgb,var(--native-muted)_70%,transparent)]",
  stateLoading: "text-sm text-[var(--native-muted)]",
  // 行内重试按钮（error 态、刷新提示条复用）。
  stateRetry:
    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[color:color-mix(in_srgb,#dc2626_40%,transparent)] bg-[color:color-mix(in_srgb,#dc2626_8%,transparent)] px-3 text-[12.5px] font-bold text-[#dc2626] transition-[background-color,border-color] hover:bg-[color:color-mix(in_srgb,#dc2626_14%,transparent)]",
  // empty 态的「清除搜索与筛选」按钮（中性主色描边）。
  stateClear:
    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[8px] border border-[var(--native-border)] bg-[var(--native-panel)] px-3 text-[12.5px] font-bold text-[var(--native-foreground)] transition-[border-color,color] hover:border-[var(--native-dim)]",
  // 非阻断刷新提示条（T2-1）：表格顶部一条警示色细条。
  refreshBar:
    "mb-3 flex items-center justify-between gap-3 rounded-[8px] border border-[color:color-mix(in_srgb,#dc2626_30%,transparent)] bg-[color:color-mix(in_srgb,#dc2626_6%,transparent)] px-3 py-2 text-[12.5px] font-medium text-[#dc2626]",
  // loading 骨架行：与 error/empty 的居中灰字明显不同。
  skeletonRow:
    "h-12 w-full animate-pulse rounded-[8px] bg-[color:color-mix(in_oklab,var(--native-surface)_70%,var(--native-panel))]",
  overlay: "absolute inset-0 z-10 flex items-center justify-center bg-[color:color-mix(in_oklab,var(--native-panel)_70%,transparent)] backdrop-blur-[4px]",
  spinner: "h-8 w-8 animate-spin rounded-full border-[3px] border-[color:color-mix(in_srgb,var(--native-border)_30%,transparent)] border-t-[var(--native-primary)]",
  thead: "bg-[color:color-mix(in_oklab,var(--native-surface)_82%,var(--native-panel))]",
  th: "h-auto whitespace-nowrap border-b border-[color:color-mix(in_oklab,var(--native-border)_34%,transparent)] px-3 py-[0.5625rem] text-left align-middle text-[11px] font-semibold tracking-[0.04em] text-[var(--native-muted)]",
  td: "align-middle border-b border-[color:color-mix(in_oklab,var(--native-border)_20%,transparent)] px-3 py-[0.6875rem]",
  row: "cursor-pointer transition-[background-color] hover:bg-[color:color-mix(in_oklab,var(--native-primary)_4%,transparent)]",
  item: "font-semibold text-[var(--native-foreground)]",
  mut: "text-[var(--native-muted)] [font-variant-numeric:tabular-nums]",
  colTitle: "w-[14%] min-w-[6rem] max-w-[22rem]",
  colDescription: "w-[28%] min-w-[10rem]",
  colFavorite: "w-20 max-w-20",
  colCategory: "w-[7rem] min-w-[7rem]",
  colSecurity: "w-[8rem] max-w-[8rem]",
  colTag: "w-[13rem] min-w-[13rem]",
  colSource: "w-[7.2rem] min-w-[7.2rem]",
  colExperienceScore: "w-[6.05rem] max-w-[6.05rem]",
  colUpdated: "w-[6.05rem] max-w-[6.05rem]",
  colAction: "w-[5.5rem] min-w-[5.5rem]",
  sort: "flex w-full items-center justify-between bg-transparent p-0 text-inherit transition-colors hover:text-[var(--native-foreground)]",
  sortOn: "text-[var(--native-foreground)]",
  sortIcon: "inline-flex flex-col items-center justify-center gap-0.5",
  sortUp: "h-0 w-0 border-l-[4px] border-r-[4px] border-b-[5px] border-l-transparent border-r-transparent border-b-[color:color-mix(in_srgb,var(--native-dim)_40%,transparent)] transition-[border-color]",
  sortUpOn: "border-b-[var(--native-primary)]",
  sortDown: "h-0 w-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[color:color-mix(in_srgb,var(--native-dim)_40%,transparent)] transition-[border-color]",
  sortDownOn: "border-t-[var(--native-primary)]",
  pager: "flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
  pagerSum: "text-[0.8125rem] leading-[1.55] text-[var(--native-muted)]",
  pagerActs: "flex flex-wrap items-center justify-end gap-2",
  page: "inline-flex h-8 w-8 items-center justify-center rounded-[var(--native-radius-full)] border border-transparent bg-transparent text-[var(--native-muted)] transition-[background-color,color,border-color] hover:bg-[color:color-mix(in_oklab,var(--native-surface)_72%,transparent)] hover:text-[var(--native-foreground)] disabled:cursor-not-allowed disabled:opacity-[var(--native-disabled-opacity)]",
  pageOn: "border-[color:color-mix(in_srgb,var(--native-primary)_28%,transparent)] bg-[var(--native-primary)] text-[var(--native-primary-foreground)]",
  tshell: "overflow-hidden rounded-[0.375rem] border border-[color:color-mix(in_oklab,var(--native-border)_38%,transparent)] bg-[color:color-mix(in_oklab,var(--native-panel)_76%,var(--native-bg-subtle))]",
  dt: "w-full border-collapse text-[0.8125rem] [&_thead]:bg-[color:color-mix(in_oklab,var(--native-surface)_82%,var(--native-panel))] [&_th]:border-b [&_th]:border-[color:color-mix(in_oklab,var(--native-border)_34%,transparent)] [&_th]:px-3 [&_th]:py-[0.5625rem] [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-[0.04em] [&_th]:text-[var(--native-muted)] [&_td]:border-b [&_td]:border-[color:color-mix(in_oklab,var(--native-border)_20%,transparent)] [&_td]:px-3 [&_td]:py-[0.6875rem] [&_td]:align-middle [&_tbody_tr]:cursor-pointer [&_tbody_tr]:transition-[background-color] [&_tbody_tr:hover]:bg-[color:color-mix(in_oklab,var(--native-primary)_4%,transparent)]",
  dtStatic: "w-full border-collapse text-[0.8125rem] [&_thead]:bg-[color:color-mix(in_oklab,var(--native-surface)_82%,var(--native-panel))] [&_th]:border-b [&_th]:border-[color:color-mix(in_oklab,var(--native-border)_34%,transparent)] [&_th]:px-3 [&_th]:py-[0.5625rem] [&_th]:text-left [&_th]:text-[11px] [&_th]:font-semibold [&_th]:tracking-[0.04em] [&_th]:text-[var(--native-muted)] [&_td]:border-b [&_td]:border-[color:color-mix(in_oklab,var(--native-border)_20%,transparent)] [&_td]:px-3 [&_td]:py-[0.6875rem] [&_td]:align-middle",
} as const
