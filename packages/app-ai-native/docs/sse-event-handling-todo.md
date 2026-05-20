# SSE 事件消费补全 — 任务跟踪

> 前提：csc serve 已完成事件标准化整改，输出 opencode canonical 格式
> 关联文档：
> - `D:\DEV\csc\docs\serve\consumer-capability-checklist.md` — 完整消费能力 checklist（含已实现/未实现标记）
> - `D:\DEV\csc\docs\serve\serve-event-standardization-proposal.md` — csc 侧事件标准化方案
> - `D:\DEV\csc\docs\serve\serve-event-standardization-todo.md` — csc 侧实施进度

---

## 现状概览

app-ai-native 的 SSE 事件消费集中在两个文件：

| 文件 | 职责 |
|---|---|
| `src/context/device-workspace.tsx` | Workspace 级 SSE 事件分发（session.created/updated/deleted） |
| `src/context/device-session.tsx` | Session 级 SSE 事件消费（message/part/permission/question/status/diff/todo） |

**已有能力**：消息生命周期、Part 类型渲染（text/reasoning/tool 全状态机）、流式渲染（createPacedValue）、Session CRUD、权限/问答、diff 预览

**缺失能力**：以下 12 项需新增实现，按优先级分三档

---

## P0 — 高优先级（核心体验影响）

### 1. `session.error` 事件处理 ✅

- **现状**：opencode SDK 中有 `session.error` 类型定义，但 app-ai-native 的 `device-session.tsx` 中无 switch case 处理
- **影响**：API 错误、重试、过载等场景用户完全无感知
- **实现要点**：
  - [x] `device-session.tsx` 新增 `case "session.error"` 处理
  - [x] 解构 `{ error: { subtype, message, retryInMs, retryAttempt, maxRetries } }`
  - [x] 存入 session state（新增 `error` 字段）
  - [x] UI 层：session header 或消息区域显示错误 banner
  - [x] 错误恢复后（收到 `message.updated` role=user）自动清除 banner
- **已修改文件**：
  - `src/context/device-session.tsx` — `SessionData.error` 字段 + 事件处理 + 错误清除
  - `src/pages/workspace/components/device-session-tab.tsx` — `SessionErrorBanner` 组件

### 2. `message.removed` 事件处理 ✅

- **现状**：无 switch case 处理
- **影响**：tombstone 消息无法被移除，用户可能看到已删除的消息残留
- **实现要点**：
  - [x] `device-session.tsx` 新增 `case "message.removed"` 处理
  - [x] 从消息 store 中移除对应 `messageID` 的消息
  - [x] 同时清理 `parts` 中对应数据
- **已修改文件**：`src/context/device-session.tsx`

### 3. `tool.progress` 事件处理 ✅

- **现状**：无 `tool.progress` 事件处理
- **影响**：Bash 等长运行工具无法显示实时输出，用户只能看到最终结果
- **实现要点**：
  - [x] `device-session.tsx` 新增 `case "tool.progress"` 处理
  - [x] 关联 `toolUseID` / `parentToolUseID` 到 progress store
  - [x] 新增 `toolProgress: Record<string, string>` 字段，累积 progress data
  - [x] UI 消费端可通过 `session.data.toolProgress[toolUseID]` 获取实时输出
- **已修改文件**：`src/context/device-session.tsx`
- **注**：ToolPart 渲染器（BashToolRenderer 等）在 `@opencode-ai/ui` 包中，progress 数据已暴露但 renderer 集成需后续在 ui 包中完成

---

## P1 — 中优先级（增强体验）

### 4. `task.*` 事件消费

- **现状**：无 `task.started`/`task.progress`/`task.completed` 事件处理。当前通过 ToolPart (`tool === "task"`) 状态转换 + `todo.updated` 间接推断任务进度
- **影响**：无独立任务面板，无法追踪后台 agent 任务生命周期
- **实现要点**：
  - [ ] 新建 `src/hooks/use-task-state.ts` — TaskState Map 管理
  - [ ] `device-session.tsx` 新增 `case "task.started"` — 创建任务条目
  - [ ] `device-session.tsx` 新增 `case "task.progress"` — 更新进度
  - [ ] `device-session.tsx` 新增 `case "task.completed"` — 标记终态
  - [ ] 可选：新建 `src/components/task-panel.tsx` — 任务列表面板
- **数据结构**：
  ```typescript
  interface TaskState {
    taskID: string
    status: "running" | "completed" | "failed" | "stopped"
    description: string
    taskType?: string
    summary?: string
    usage?: { total_tokens: number; tool_uses: number; duration_ms: number }
    startTime: number
    endTime?: number
  }
  ```

### 5. `session.warning` / `session.info` 事件处理

- **现状**：无处理
- **影响**：cache_warning、informational system 消息等无展示
- **实现要点**：
  - [ ] `device-session.tsx` 新增 `case "session.warning"` 处理
  - [ ] `device-session.tsx` 新增 `case "session.info"` 处理
  - [ ] 存入 session state 的 `notifications` 数组（或独立 signal）
  - [ ] UI 层：非阻塞式 toast / banner 展示，自动消失或手动关闭
- **建议文件**：
  - `src/context/device-session.tsx`
  - 复用或扩展现有 notification/toast 组件

### 6. `message.attachment` 事件处理

- **现状**：无处理
- **影响**：hook 执行结果、相关记忆、诊断信息等附加数据无展示
- **实现要点**：
  - [ ] `device-session.tsx` 新增 `case "message.attachment"` 处理
  - [ ] 按 `attachmentType` 分发：
    - `hook_success` / `hook_error` / `hook_cancelled` — hook 结果展示
    - `relevant_memories` / `nested_memory` — 记忆引用展示
    - `diagnostics` — 诊断信息展示
    - `token_usage` / `budget_usd` — token/预算信息
    - `invoked_skills` — 已调用 skill 列表
  - [ ] 关联到当前消息，作为消息附加区域渲染
- **建议文件**：
  - `src/context/device-session.tsx`
  - 可选新建 `src/components/message-attachment.tsx`

### 7. Cost/Token 详细追踪

- **现状**：仅有消息级 cost 累加，无步骤级/缓存级展示
- **影响**：用户无法了解每步成本、缓存命中情况
- **实现要点**：
  - [ ] StepFinishPart 渲染扩展：显示 `cost` + `tokens` 详情
  - [ ] 会话级 cost 汇总（从所有 StepFinishPart 累加或从 message.updated 提取）
  - [ ] Cache token 展示：`cache.read` vs `cache.write` 分离显示
  - [ ] 可选：hover tooltip 显示每步成本明细
- **建议文件**：
  - StepFinishPart 组件渲染扩展
  - 可选新建 `src/hooks/use-session-cost.ts`

---

## P2 — 低优先级（锦上添花）

### 8. `session.metrics` 事件处理

- [ ] `device-session.tsx` 新增 `case "session.metrics"` 处理
- [ ] 新建 MetricsPanel 组件（turn_duration, TTFT 等）
- [ ] 可折叠/可关闭面板

### 9. `session.hook_summary` 事件处理

- [ ] `device-session.tsx` 新增 `case "session.hook_summary"` 处理
- [ ] hook 执行汇总展示（执行了哪些 hook、结果、耗时）

### 10. Task 进度条

- [ ] 依赖任务 #4 的 TaskState
- [ ] `task.progress` 的 `workflowProgress` 渲染为 phase 级别进度条
- [ ] 任务面板内展示

### 11. 后台任务通知

- [ ] 任务完成时触发 toast / desktop notification
- [ ] 使用 Web Notification API 或 in-app toast

### 12. Cache Token 展示

- [ ] 依赖任务 #7 的 cost 追踪
- [ ] 在 session header 或独立面板展示 cache read vs write token

---

## 实施顺序建议

```
P0.2 message.removed  ──┐
P0.1 session.error    ──┤── 第一批（快速补全，改动小）
P0.3 tool.progress    ──┘
         │
P1.5 session.warning/info ──┐
P1.6 message.attachment  ──┤── 第二批（扩展事件覆盖）
P1.7 Cost/Token 追踪     ──┘
         │
P1.4 task.* 事件 ──────────── 第三批（需新建状态管理 + UI）
         │
P2.8~P2.12 ────────────────── 第四批（按需实现）
```

## 关联源文件

| 文件 | 说明 |
|---|---|
| `src/context/device-session.tsx` | SSE 事件消费主入口，所有新事件处理添加于此 |
| `src/context/device-workspace.tsx` | Workspace 级事件分发（session.created/updated/deleted） |
| `src/context/device-client.ts` | SSE 传输层（fetch + ReadableStream） |
| `src/components/message/` | 消息渲染组件目录 |
| `src/components/parts/` 或等效 | Part 类型渲染组件（TextPart、ReasoningPart、ToolPart 等） |
