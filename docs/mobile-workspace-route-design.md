# 移动端 Workspace 路由页面实现方案

## 1. 目标

新增 `/m/workspace` 路由，专门服务移动端场景。功能范围：

- **空间列表卡片**：展示所有 workspace，支持切换
- **Session List**：当前 workspace 下的会话列表
- **Session Tab**：会话消息时间线 + 输入框

不包含：文件树、Diff 查看、终端、设备管理。

## 2. 现有架构分析

### 2.1 路由结构（`src/routes.tsx`）

```
/workspace                     → WorkspaceLayout（全局状态管理 + 壳布局）
  ├── /                        → WorkspaceHome（引导首页）
  └── /:workspaceID            → WorkspaceLayout（复用，实际渲染 WorkspaceContent）
```

`WorkspaceLayout` 承担了双重职责：既是路由入口组件（管理 workspaces/devices 数据），又是 `/:workspaceID` 的子路由组件（但子路由实际无独立组件，内容由父级 `WorkspaceContent` 按 `params.workspaceID` 渲染对应实例）。

### 2.2 组件层级（精简）

```
WorkspaceLayout (layout.tsx)
├── WorkspaceProvider                    ← 全局 workspace/device 状态
├── ActiveWorkspaceProvider              ← 活跃 workspace 跟踪
├── WorkspaceServerProvider              ← Server 连接池
├── WorkspaceActivation                 ← URL ↔ 状态同步
└── WorkspaceShell                      ← 壳布局（sidebar + content）
    ├── WorkspaceSidebar                ← 空间卡片列表 + 设备列表
    │   ├── WorkspaceCard (running)     ← 运行中（详细）
    │   ├── WorkspaceCard (idle)        ← 空闲（紧凑）
    │   └── DeviceList                  ← 设备管理
    └── WorkspaceContent               ← 多实例管理器
        ├── WorkspaceHome              ← 无 workspaceID 时显示
        └── WorkspaceContentInstance ×N ← 每个 enabled workspace
            └── DirectDeviceProviders  ← Device SDK/Client 注入链
                └── ...（InitGate → Workspace → File → Terminal → Local → ContentTab）
                    └── WorkspaceContentLayout
                        ├── ContentSidebar           ← Session列表 + 文件树 + Changes
                        │   └── Sessions 按时间分组
                        ├── ContentTabPanel
                        │   └── DeviceSessionTab     ← 消息 + Composer
                        │   └── TerminalTab
                        │   └── FilePreviewTab
                        │   └── DiffPreviewTab
                        └── ResizeHandle + 右侧面板
```

### 2.3 核心依赖链

| Context | 提供者 | 移动端是否需要 |
|---------|--------|:-------------:|
| `WorkspaceContext` | `layout.tsx` WorkspaceProvider | ✅ |
| `ActiveWorkspace` | `active-workspace.tsx` | ✅ |
| `ServerContext` | `WorkspaceServerProvider` | ✅ |
| `DeviceClientContext` | `DirectDeviceProviders` | ✅ |
| `DeviceSDKContext` | `DirectDeviceProviders` | ✅ |
| `DeviceInitGate` | 同上 | ✅ |
| `WorkspaceInitGate` | 同上 | ✅ |
| `DeviceWorkspaceProvider` | 同上 | ✅（提供 session 数据） |
| `DeviceFileProvider` | 同上 | ✅（DeviceSessionTab 间接依赖） |
| `DeviceTerminalProvider` | 同上 | ⚠️ 可 stub，但保留更安全 |
| `DeviceLocalProvider` | 同上 | ✅ |
| `ContentTabContext` | `WorkspaceContentInstance` | ✅ |
| `LayoutContext` | `DeviceLayoutProvider` | ✅ |

**结论**：移动端的 `WorkspaceContentInstance` 内部 context 链需要完整保留。裁剪点在**布局层**和**侧边栏内容**。

### 2.4 不可裁剪的内部依赖

`DeviceSessionTab` → `DeviceSessionProvider` → `MessageTimeline` + `SessionComposerRegion`

这条链依赖 `DeviceWorkspaceProvider`（session CRUD）、`DeviceFileProvider`（文件相关上下文）、`DeviceSDKContext`（SDK 调用）。因此 `WorkspaceContentInstance` 的 context 链必须完整保留。

## 3. 设计方案

### 3.1 路由设计

```
/m/workspace                        → MobileWorkspaceLayout（移动端壳）
  ├── /                             → MobileWorkspaceHome（空间卡片选择页）
  └── /:workspaceID                 → MobileWorkspaceDetail（session list + session tab）
```

### 3.2 页面视图

**视图 A：空间卡片选择页（`/m/workspace`）**

```
┌─────────────────────────┐
│  Workspace              │  ← 顶部标题栏
├─────────────────────────┤
│  🔍 搜索...              │  ← 搜索框
├─────────────────────────┤
│  ● 运行中 (2)            │  ← 分组标题
│  ┌─────────────────────┐│
│  │ ● workspace-1       ││  ← WorkspaceCard（复用现有组件逻辑）
│  │   main · /path      ││
│  └─────────────────────┘│
│  ┌─────────────────────┐│
│  │ ● workspace-2       ││
│  │   dev · /path2      ││
│  └─────────────────────┘│
├─────────────────────────┤
│  ○ 空闲 (3)              │
│  ┌─────────────────────┐│
│  │ ○ workspace-3       ││
│  └─────────────────────┘│
│  ...                    │
└─────────────────────────┘
```

**视图 B：Workspace 详情页（`/m/workspace/:workspaceID`）**

```
┌─────────────────────────┐
│  ← workspace-1    [≡]   │  ← 顶部导航栏（返回 + workspace 名 + 切换按钮）
├─────────────────────────┤
│  Session List            │  ← 可折叠/滑出的 session 列表面板
│  ┌─ 今天 ──────────────┐│
│  │ 🟢 Fix login bug    ││
│  │ ⚪ Add tests         ││
│  ├─ 本周 ──────────────┤│
│  │ ⚪ Refactor API      ││
│  └─────────────────────┘│
├─────────────────────────┤
│                          │
│  Session Tab Content     │  ← DeviceSessionTab（消息时间线）
│  (MessageTimeline)       │
│                          │
│                          │
├─────────────────────────┤
│  [输入框 / Composer]     │  ← SessionComposerRegion
└─────────────────────────┘
```

### 3.3 组件复用策略

#### 完全复用（不修改）

| 组件/模块 | 来源 | 说明 |
|-----------|------|------|
| `WorkspaceContentInstance` | `layout.tsx` | 完整 context 链 + `WorkspaceContentLayout` |
| `DeviceSessionTab` | `device-session-tab.tsx` | 消息 + Composer，直接用 |
| `ContentTabContext` + `createContentTabStore` | `content-tabs.ts` | Tab 状态管理 |
| `WorkspaceProvider` + `WorkspaceContextValue` | `context.tsx` | 全局 workspace 状态 |
| `ActiveWorkspaceProvider` | `active-workspace.tsx` | 活跃 workspace |
| `WorkspaceServerProvider` | `layout.tsx` | Server 连接 |
| `WorkspaceActivation` | `layout.tsx` | URL 参数同步 |
| 所有 API 和 types | `lib/api.ts`, `types.ts` | 数据层完全共享 |

#### 提取复用（从现有组件中提取）

| 组件 | 提取来源 | 说明 |
|------|----------|------|
| `WorkspaceCard` | `workspace-sidebar.tsx` | 卡片渲染逻辑是 `WorkspaceSidebar` 内的局部组件，需提取为独立导出 |
| `SessionList` | `workspace-content-layout.tsx` ContentSidebar | Session 分组、渲染、交互逻辑（`sortedSessions`, `sessionGroups`, `openSession`, `deleteSession`）是 `ContentSidebar` 的内部实现，需提取 |

#### 新建组件

| 组件 | 文件 | 说明 |
|------|------|------|
| `MobileWorkspaceLayout` | `pages/workspace/mobile/layout.tsx` | 移动端壳布局，复用 context 链 |
| `MobileWorkspaceHome` | `pages/workspace/mobile/home.tsx` | 空间卡片选择页 |
| `MobileWorkspaceDetail` | `pages/workspace/mobile/detail.tsx` | Session list + Session tab 视图 |
| `MobileWorkspaceHeader` | `pages/workspace/mobile/header.tsx` | 顶部导航栏（返回 + workspace 名 + workspace 切换入口） |

### 3.4 布局架构

移动端不使用 `WorkspaceShell`（左右分栏），而是采用**垂直栈式导航**：

```
MobileWorkspaceLayout
├── WorkspaceProvider           ← 共享数据
├── ActiveWorkspaceProvider     ← 共享活跃状态
├── WorkspaceServerProvider     ← 共享连接
├── WorkspaceActivation         ← 共享 URL 同步
└── <Router Outlet>             ← 子路由渲染
    ├── / → MobileWorkspaceHome
    │   └── WorkspaceCard × N   ← 复用/提取的卡片组件
    └── /:workspaceID → MobileWorkspaceDetail
        └── WorkspaceContentInstance   ← 完全复用
            └── MobileWorkspaceContentLayout（新）
                ├── MobileSessionList（提取自 ContentSidebar）
                │   └── 按时间分组 + 点击打开 session tab
                ├── MobileSessionView（简化）
                │   └── DeviceSessionTab（复用）
                └── 底部 Composer（复用 SessionComposerRegion）
```

## 4. 文件变更计划

### 4.1 新建文件

```
src/pages/workspace/mobile/
├── layout.tsx          # MobileWorkspaceLayout
├── home.tsx            # MobileWorkspaceHome
├── detail.tsx          # MobileWorkspaceDetail
├── header.tsx          # MobileWorkspaceHeader
└── session-list.tsx    # MobileSessionList（提取自 ContentSidebar）
```

### 4.2 需修改的文件

| 文件 | 变更内容 |
|------|----------|
| `src/routes.tsx` | 添加 `/m/workspace` 路由配置，lazy import 移动端组件 |
| `src/pages/workspace/index.ts` | 导出移动端组件 |
| `src/pages/workspace/components/workspace-sidebar.tsx` | 提取 `WorkspaceCard` 为独立可导出组件 |
| `src/pages/workspace/components/workspace-content-layout.tsx` | 提取 session 列表逻辑为可复用函数/组件 |

### 4.3 不修改的文件

- `layout.tsx`（现有 WorkspaceLayout 不动）
- `device-session-tab.tsx`（直接复用）
- `context.tsx`（直接复用）
- `active-workspace.tsx`（直接复用）
- 所有 `context/device-*.tsx`（直接复用）
- `content-tabs.ts`（直接复用）

## 5. 实现步骤

### Phase 1：提取可复用组件（无功能变更）

1. **提取 `WorkspaceCard`**
   - 从 `workspace-sidebar.tsx` 中将 `WorkspaceCard` 局部组件提取为独立导出
   - 保持接口不变，仅将内部函数提升为模块级导出
   - 原有 `WorkspaceSidebar` 内部改为 import 使用，行为不变

2. **提取 Session 列表逻辑**
   - 从 `workspace-content-layout.tsx` 的 `ContentSidebar` 中提取：
     - `sortedSessions` memo
     - `sessionGroups` memo
     - `sessionGroup` 工具函数
     - `openSession` / `deleteSession` 逻辑
     - Session 列表渲染 JSX
   - 封装为 `SessionListPanel` 组件，接收必要的 props/callbacks

### Phase 2：移动端路由和壳布局

3. **添加路由配置**
   - `routes.tsx` 新增：
     ```tsx
     {
       path: "/m/workspace",
       component: MobileWorkspaceLayout,
       auth: true,
       children: [
         { path: "/", component: MobileWorkspaceHome },
         { path: "/:workspaceID", component: MobileWorkspaceDetail },
       ],
     }
     ```

4. **实现 `MobileWorkspaceLayout`**
   - 复用完整的 context provider 链（WorkspaceProvider → ActiveWorkspaceProvider → WorkspaceServerProvider → WorkspaceActivation）
   - 不使用 `WorkspaceShell`（无 sidebar 分栏），改为全屏 `<Router Outlet>`
   - 管理与 `WorkspaceLayout` 相同的 workspaces/devices 状态（可考虑将状态管理提取为共享 hook）

5. **实现 `MobileWorkspaceHome`**
   - 全屏卡片列表视图
   - 复用提取出的 `WorkspaceCard` 组件
   - 点击卡片 → `navigate('/m/workspace/:id')`
   - 显示 running/idle 分组
   - 搜索框

### Phase 3：Workspace 详情页

6. **实现 `MobileWorkspaceDetail`**
   - 根据路由 `params.workspaceID` 渲染 `WorkspaceContentInstance`（完全复用）
   - `WorkspaceContentInstance` 内部使用新的 `MobileWorkspaceContentLayout` 替代 `WorkspaceContentLayout`

7. **实现 `MobileWorkspaceContentLayout`**
   - 简化版布局：无文件树、无 diff panel、无 resize handle
   - 上方：Session 列表（可折叠，或作为从顶部/左侧滑出的 sheet）
   - 中间：活跃 Session 的 `DeviceSessionTab`
   - 底部：Composer 固定
   - 复用 `ContentTabContext` 管理 session tabs（仅 session 类型）
   - 复用 `DeviceSessionProvider` 包装 `DeviceSessionTab`

8. **实现 `MobileWorkspaceHeader`**
   - 返回按钮（`←`，导航回 `/m/workspace`）
   - 当前 workspace 名称
   - workspace 切换按钮（`[≡]`，打开 workspace 列表 sheet/overlay）

### Phase 4：导航和交互优化

9. **导航 hook 扩展**
   - `useWorkspaceNavigate` 添加移动端路径支持，或新建 `useMobileWorkspaceNavigate`
   - 确保路径前缀为 `/m/workspace`

10. **workspace 切换交互**
    - 在详情页点击 workspace 切换按钮 → 弹出 workspace 卡片列表（全屏 overlay 或 bottom sheet）
    - 选择后切换当前 workspace（`navigate('/m/workspace/:newId')`）

## 6. 关键技术决策

### 6.1 状态共享策略

**选项 A：独立状态** — 移动端布局有自己的 workspaces/devices 加载逻辑（复制 `WorkspaceLayout` 的数据加载逻辑）
**选项 B：提取共享 hook** — 将 workspaces/devices 数据管理提取为 `useWorkspaceData()` hook，桌面端和移动端共用

**推荐选项 B**。将 `WorkspaceLayout` 中的以下逻辑提取到 `useWorkspaceData()` hook：
- workspaces/devices store 和 API 加载
- 30 秒轮询
- enable/disable/select 操作
- create/delete/rename 操作
- deferDisable 和 offline 处理

这样 `WorkspaceLayout` 和 `MobileWorkspaceLayout` 都调用同一个 hook，逻辑不重复。

### 6.2 Session 列表展示方式

**选项 A：内嵌顶部区域** — Session 列表始终显示在页面上方，可折叠
**选项 B：滑出面板** — 点击按钮从左/下方向滑出 session 列表面板
**选项 C：全屏切换** — session 列表和 session 内容为两个全屏视图，通过手势/按钮切换

**推荐选项 B（底部 sheet）**。移动端空间有限，默认展示 session 内容，通过向上拖拽或点击 header 中的按钮展开 session 列表。这样既保留了空间切换的便捷性，又不会压缩 session 内容区域。

### 6.3 路由共享 vs 独立

移动端路由完全独立于桌面端（`/m/workspace` vs `/workspace`），好处是：
- 不会影响现有桌面端逻辑
- 可以独立迭代 UI
- 不需要在组件内做 `isMobile` 判断

用户在桌面端访问 `/m/workspace` 也能正常使用（仅 UI 是移动端风格），无需额外限制。

## 7. 风险和注意事项

### 7.1 Context 链完整性

`WorkspaceContentInstance` 内部依赖完整的 context provider 链。任何遗漏都会导致运行时错误。实现时必须确保复用该组件时提供所有必要的 context。

### 7.2 现有组件的提取

从 `WorkspaceSidebar` 提取 `WorkspaceCard` 和从 `ContentSidebar` 提取 session 列表时，需要确保不破坏现有桌面端功能。建议：
- 先提取，确保现有功能不受影响（运行现有测试）
- 再在移动端使用提取后的组件

### 7.3 URL 参数同步

`WorkspaceActivation` 依赖 `params.workspaceID` 进行 URL → 状态同步。移动端路由也使用 `:workspaceID` 参数名，因此该组件可直接复用。

### 7.4 WebSocket 连接管理

`WorkspaceServerProvider` 会为所有 enabled workspaces 创建连接。移动端同样需要这个能力（因为可能需要同时监控多个 workspace 的 pending interaction 状态）。如果移动端只需要单 workspace，可以考虑简化为只连接当前活跃 workspace。

### 7.5 响应式边界

移动端布局使用固定全宽设计，不需要响应式断点。但应设置合理的最大宽度（如 `max-w-[100dvw]`），并使用 `dvh` 单位处理移动浏览器地址栏。

## 8. 验收标准

- [ ] `/m/workspace` 路由可正常访问（需登录）
- [ ] 空间卡片列表正确展示 running/idle 分组
- [ ] 点击空间卡片可进入对应 workspace 详情
- [ ] Session 列表按时间分组展示（今天/本周/更早）
- [ ] 点击 session 可查看消息时间线
- [ ] Composer 可正常发送消息
- [ ] 顶部导航栏可返回空间列表
- [ ] workspace 切换功能正常
- [ ] 桌面端 `/workspace` 路由不受影响
- [ ] 现有测试通过
