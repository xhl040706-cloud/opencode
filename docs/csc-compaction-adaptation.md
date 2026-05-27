# csc Compaction 适配技术提案

## 背景

消费端 `packages/app-ai-native` 的会话压缩功能按照 opencode 标准流程实现，通过 SSE 事件驱动前端 UI 更新。当前 csc agent 执行 `/compact` 命令后，其 stdout 输出经 cs-cloud 桥接层翻译为 opencode SSE 格式，但存在事件序列不完整、消息角色错误等问题，导致前端无法正常展示压缩结果和续接会话。

## 目标

1. **主动压缩**：用户通过 `/compact` 命令触发压缩，前端正确展示压缩状态
2. **展示压缩结果**：压缩摘要作为 assistant 消息出现在会话流中
3. **继续会话**：压缩完成后自动续接，会话可正常继续

---

## 一、opencode 标准压缩流程

用户触发 `/compact` 时，opencode 后端（`packages/opencode/src/session/compaction.ts`）产生以下 SSE 事件序列：

```
┌─────────────────────────────────────────────────────┐
│ 1. 触发阶段                                         │
│    message.updated        → user message            │
│    message.part.updated   → compaction part         │
├─────────────────────────────────────────────────────┤
│ 2. AI 生成摘要阶段                                  │
│    message.updated        → assistant message       │
│                              summary: true          │
│                              mode: "compaction"     │
│    message.part.updated   → step-start              │
│    message.part.updated   → text (摘要正文)         │
│    message.part.updated   → step-finish             │
│    message.updated        → assistant message       │
│                              (补全 time.completed)  │
├─────────────────────────────────────────────────────┤
│ 3. 续接阶段                                         │
│    message.updated        → user message            │
│    message.part.updated   → text "Continue..."      │
├─────────────────────────────────────────────────────┤
│ 4. 完成                                             │
│    session.result                                  │
│    session.status         → idle                    │
└─────────────────────────────────────────────────────┘
```

前端消费端 `device-session.tsx` 按 SSE 事件类型处理——`message.updated` 更新消息列表，`message.part.updated` 更新/创建 part（text、tool、compaction、reasoning、step-start/finish 等）。前端**不需要**特殊处理 compaction，只要后端按标准格式推送即可。

---

## 二、csc 当前实现与差异分析

### 2.1 事件流路径

```
用户 /compact
  → cs-cloud POST /conversations/{id}/command
    → csc POST /session/{id}/command → handle.prompt('/compact')
      → csc processSlashCommand → compact.ts call()
        → 返回 CompactionResult
      → buildPostCompactMessages: [boundaryMarker, summaryMessages, messagesToKeep, ...]
      → QueryEngine shouldQuery=false, 逐条 yield 到 stdout
        → sessionMessageRouter.ts routeMessage()
          → emitOpencodeEvent (带 _native_opencode: true)
            → cs-cloud adapter_sse.go adaptEventMap → 直接透传到前端
```

### 2.2 关键发现

**`emitOpencodeEvent` 确认设置 `_native_opencode: true`**（`sessionHandle.ts:432-442`），cs-cloud 的 `adaptEventMap` 会跳过翻译直接透传。因此所有通过 `emitOpencodeEvent` 发射的事件会原样到达前端，**cs-cloud 桥接层无需额外适配**。

**`compact_boundary` 双路径问题**：csc stdout 原始消息同时被 cs-cloud 的 `adapter_sse_message.go:18-32` 处理，会产生双重发射。需要在 cs-cloud 侧移除该逻辑。

### 2.3 当前问题

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | 缺少 user message 包装 compaction part | `sessionMessageRouter.ts:937-948` `emitCompactionEvent` | compaction part 没有 `messageID`，前端无法关联到消息 |
| 2 | 摘要消息角色错误 | `sessionMessageRouter.ts:350` `handleUserMessage` 未识别 `isCompactSummary` | compact summary 作为 user 消息渲染，而非 assistant 摘要 |
| 3 | 缺少续接消息 | `sessionMessageRouter.ts:403` `handleResultMessage` 无 compact 判断 | 压缩后会话无法自动继续 |
| 4 | compaction part 缺少标准字段 | `emitCompactionEvent` | 缺 `messageID`、`sessionID`(part 层级)、`time` |
| 5 | cs-cloud 双重发射 | `adapter_sse_message.go:18-32` | stdout 路径和 emitOpencodeEvent 路径同时发射 compaction part |

### 2.4 stdout 消息序列

csc QueryEngine 在 `shouldQuery=false` 时按以下顺序 yield 消息到 stdout：

```
1. compact_boundary (SystemMessage, subtype='compact_boundary')
2. summary message 1 (UserMessage, isCompactSummary=true)
3. summary message 2 (UserMessage, isCompactSummary=true)
   ... (可能有多个 summary 消息)
4. messagesToKeep 中的 user 消息 (普通 UserMessage)
5. attachments (AttachmentMessage)
6. hookResults (HookResultMessage)
7. result (type='result', subtype='success')
```

`sessionMessageRouter.ts` 按顺序接收这些消息：
- ① → `handleSystemMessage` → `emitCompactionEvent`
- ②③ → `handleUserMessage`（当前作为普通 user 处理）
- ④⑤⑥ → `handleUserMessage` / 其他 handler
- ⑦ → `handleResultMessage`

---

## 三、解决方案设计

### 3.1 设计原则

1. **最小侵入**：改动集中在 `sessionMessageRouter.ts` 的消息翻译层，不涉及 csc 核心压缩算法、JSONL 持久化
2. **状态追踪**：通过 context 状态标记追踪压缩阶段，避免依赖脆弱的消息内容匹配
3. **兼容优先**：前端消费端不需要改动，cs-cloud 仅移除冗余逻辑

### 3.2 整体架构

```
                    csc stdout 消息流
                          │
              ┌───────────┴───────────┐
              │ sessionMessageRouter  │
              │                       │
              │ ① handleSystemMessage │  compact_boundary
              │    emitCompactionEvent│  → 新增: user message + compaction part
              │    设置 isCompacting  │  → 新增: 标记压缩状态
              │                       │
              │ ② handleUserMessage   │  isCompactSummary
              │    角色转换判断        │  → 新增: 识别并转为 assistant summary
              │                       │
              │ ③ handleResultMessage │  compact result
              │    检查 isCompacting  │  → 新增: 发射续接消息
              │    清除 isCompacting  │
              └───────────┬───────────┘
                          │
                  emitOpencodeEvent
                  (_native_opencode: true)
                          │
              ┌───────────┴───────────┐
              │ cs-cloud adapter_sse  │
              │ 直接透传 (无需翻译)    │
              │ 移除 compact_boundary  │ ← 唯一改动
              │ 独立处理逻辑           │
              └───────────┬───────────┘
                          │
                    前端 SSE 消费
              (device-session.tsx)
              (无需改动)
```

### 3.3 状态模型

在 `sessionMessageRouter.ts` 的处理上下文中引入压缩状态追踪：

```typescript
// MessageRouterCtx 扩展 (概念性描述，实际通过实现层维护)
{
  // ... 现有字段
  compactState?: {
    userMessageID: string      // 承载 compaction 的 user message ID
    isAuto: boolean            // 是否自动压缩
  }
}
```

状态生命周期：

```
compact_boundary 到达 → 设置 compactState
  ↓
isCompactSummary 消息到达 → 读取 compactState，发射 assistant summary
  ↓
result 到达 → 检测 compactState 存在 → 发射续接消息 → 清除 compactState
```

### 3.4 详细设计

#### 改动 1：完善 `emitCompactionEvent`

**文件**: `csc/src/server/sessionMessageRouter.ts`
**函数**: `emitCompactionEvent` (当前 line 937)

**改动内容**: 在发射 compaction part 之前，先创建承载它的 user message，并设置压缩状态标记。

```
改动前:
  emitCompactionEvent → 仅发射 message.part.updated (compaction part)

改动后:
  emitCompactionEvent →
    ① 创建 user message (message.updated)
    ② 发射 compaction part (message.part.updated)，关联到 user message
    ③ 设置 compactState 到 ctx
```

**设计决策**:
- user message 的 ID 由 `randomUUID()` 生成，作为临时 SSE 事件 ID
- 不尝试复用 csc 内部的消息 UUID（那些 UUID 对应 JSONL 中的记录，语义不同）
- compactState 挂载在 ctx 实现层的现有状态管理中（具体方式取决于 ctx 的可扩展性）

#### 改动 2：compact summary 角色转换

**文件**: `csc/src/server/sessionMessageRouter.ts`
**函数**: `handleUserMessage` (当前 line 350)

**改动内容**: 在 `handleUserMessage` 入口检测 `isCompactSummary` 标记，提前拦截并转换为 assistant summary 消息。

```
改动前:
  handleUserMessage → 所有 user 消息统一处理，发射 message.updated (role=user)

改动后:
  handleUserMessage →
    if (msg.isCompactSummary && ctx.compactState) →
      emitCompactSummaryMessage (新函数)
      return  // 不走原有 user 消息逻辑
    else →
      原有逻辑不变
```

**`emitCompactSummaryMessage` 设计**:

发射完整事件序列：
```
message.updated   → assistant (summary=true, mode="compaction")
message.part.updated → step-start
message.part.updated → text (摘要正文)
message.part.updated → step-finish
message.updated   → assistant (补全 time.completed, finish="stop")
```

**摘要文本提取**:
- 优先从 `msg.message.content`（string 类型）获取
- 其次从 `msg.content` 获取
- 如果 content 是数组（content blocks），遍历提取 text block

**设计决策**:
- 多个 isCompactSummary 消息（reactive compact 可能产生多个 summary）都作为 assistant summary 发射，每个独立生成 messageID
- 不尝试合并多个 summary 消息为一条，避免复杂度和时序问题
- assistant summary 的 `parentID` 设置为 compactState 中的 `userMessageID`，建立消息链关系

#### 改动 3：压缩后续接消息

**文件**: `csc/src/server/sessionMessageRouter.ts`
**函数**: `handleResultMessage` (当前 line 403)

**改动内容**: 在发射 `session.result` 之前，检查 compactState 是否存在，如果存在则发射续接消息。

```
改动前:
  handleResultMessage →
    session.status (idle)
    session.result
    session.error (if error)
    resolvePrompt

改动后:
  handleResultMessage →
    if (ctx.compactState) →
      emitCompactContinueMessage (新函数)
      清除 ctx.compactState
    session.status (idle)
    session.result
    session.error (if error)
    resolvePrompt
```

**`emitCompactContinueMessage` 设计**:

```
message.updated   → user (role=user)
message.part.updated → text (synthetic=true, "Continue if you have next steps...")
```

**设计决策**:
- 续接消息放在 `session.result` 之前发射，这样前端先收到续接消息再收到会话完成状态，与 opencode 的时序一致
- `synthetic: true` 标记让前端知道这是系统自动生成的消息，而非用户输入
- 续接消息只对手动 `/compact` 有效（auto compact 由 opencode 的 auto flow 处理），但为简化实现，统一发射

#### 改动 4：cs-cloud 移除冗余 compact_boundary 处理

**文件**: `cs-cloud/internal/agent/csc/adapter_sse_message.go`
**位置**: line 18-32

**改动内容**: 移除 `adaptMessageEvent` 中对 `compact_boundary` 的独立处理逻辑。

```
改动前:
  if compactBoundary, _ := payload["compact_boundary"].(bool); compactBoundary {
      return []sseFrame{frame("message.part.updated", ...)}
  }
  if msgType != "assistant" { return nil }

改动后:
  if msgType != "assistant" { return nil }
```

**原因**: csc 的 `emitCompactionEvent` 已通过 `emitOpencodeEvent`（带 `_native_opencode: true`）发射完整的 compaction 事件序列。cs-cloud 的 stdout 翻译路径不应再重复处理 compact_boundary。

### 3.5 完整事件序列（改动后）

用户触发 `/compact` 时，前端收到的 SSE 事件：

```
① session.status            { type: "busy" }           ← /command 端点已有

② message.updated           { role: "user" }           ← 改动 1 新增
③ message.part.updated      { type: "compaction" }     ← 改动 1 改进

④ message.updated           { role: "assistant", summary: true }  ← 改动 2 新增
⑤ message.part.updated      { type: "step-start" }                ← 改动 2 新增
⑥ message.part.updated      { type: "text" }                      ← 改动 2 新增
⑦ message.part.updated      { type: "step-finish" }               ← 改动 2 新增
⑧ message.updated           { role: "assistant", completed }      ← 改动 2 新增
  (如果有多条 isCompactSummary 消息，④-⑧ 重复)

⑨ message.updated           { role: "user" }           ← 改动 3 新增
⑩ message.part.updated      { type: "text", synthetic: true } ← 改动 3 新增

⑪ session.result                                       ← 已有
⑫ session.status            { type: "idle" }           ← 已有
```

### 3.6 替代方案评估

#### 方案 B：在 cs-cloud 桥接层做转换

将所有 compact 相关的事件翻译逻辑放在 `adapter_sse_message.go` 中，csc 侧不做改动。

**优点**: csc 完全不用动
**缺点**:
- cs-cloud 需要从 csc stdout 原始消息中提取摘要文本（compact_boundary 之后紧跟的 user 消息），时序脆弱
- cs-cloud 是 Go 代码，需要理解 csc 的消息格式
- 后续 csc 改变 compact 输出格式时需要同步修改 cs-cloud
- 违反"翻译层应该薄"的原则

**结论**: 不采纳。当前方案 A（在 csc 的 opencode 翻译层处理）更合理，因为 `sessionMessageRouter.ts` 本身就是 csc stdout → opencode SSE 的翻译层。

#### 方案 C：csc 核心 compact 逻辑直接输出 opencode 格式

修改 `compact.ts` 和 `QueryEngine.ts`，让 compact 结果直接以 opencode assistant message 格式输出到 stdout。

**优点**: 从源头解决角色问题
**缺点**:
- 改动 csc 核心压缩算法，影响 JSONL 持久化和 --resume 逻辑
- 改动面大，回归风险高
- compact 结果同时服务于 csc TUI 和 opencode SSE，两种消费端对消息格式有不同要求

**结论**: 不采纳。在翻译层处理可以保持 csc 内部消息格式不变，两种消费端互不影响。

---

## 四、文件改动清单

| 仓库 | 文件 | 改动类型 | 说明 |
|------|------|---------|------|
| csc | `src/server/sessionMessageRouter.ts` | 修改 | 完善 `emitCompactionEvent`（新增 user message + compaction part），`handleUserMessage` 新增 `isCompactSummary` 拦截，`handleResultMessage` 新增续接消息逻辑 |
| cs-cloud | `internal/agent/csc/adapter_sse_message.go` | 修改 | 移除 line 18-32 的 `compact_boundary` 独立处理 |
| app-ai-native | 无 | - | 前端消费端不需要改动 |

---

## 五、验证方案

### 5.1 事件序列验证

通过 `/compact` 命令触发压缩，监听 SSE 事件流，确认按 第三节 3.5 的完整序列输出。

### 5.2 前端 UI 验证

- [ ] 触发 `/compact` 后，会话流中出现压缩标记（compaction part 渲染）
- [ ] 压缩摘要作为 assistant 消息正确渲染（非 user 消息气泡）
- [ ] 压缩完成后出现 "Continue..." 续接消息
- [ ] 续接消息后 agent 可以正常继续工作
- [ ] 历史消息加载时，压缩摘要能正确恢复显示

### 5.3 回归测试

- [ ] csc 原有 compact 功能不受影响（JSONL 持久化、消息链完整性、--resume）
- [ ] 非 compact 场景的 SSE 事件不受影响
- [ ] cs-cloud 桥接层其他事件类型的翻译不受影响

---

## 六、风险与注意事项

1. **双重发射风险**: 如果 cs-cloud 未同步移除 `compact_boundary` 处理逻辑，会产生重复的 compaction part。建议升级顺序：先部署 csc（即使有双重发射也不影响功能，只是多一个孤立 part），再更新 cs-cloud。

2. **`isCompactSummary` 覆盖范围**: csc 有三种 compact 路径——传统 compact、reactive compact、session memory compact。需确认所有路径的 summary 消息都标记了 `isCompactSummary`。从 QueryEngine 代码看（`QueryEngine.ts:596`），三种路径最终都经过同一 yield 逻辑，标记统一。

4. **向后兼容**: 新版 csc 事件流对旧版 cs-cloud 向后兼容（只是多一个孤立的 compaction part）。新版 cs-cloud 对旧版 csc 也兼容（移除 compact_boundary 处理后，旧 csc 不通过 emitOpencodeEvent 发射 compaction，前端看不到压缩标记但不报错）。

---

## 七、SSE 实时推送 vs 历史消息加载的一致性分析

前端消费端有两条路径获取会话数据：

- **SSE 实时推送**：`sessionMessageRouter.ts` 翻译 csc stdout → `emitOpencodeEvent`（`_native_opencode: true`）→ cs-cloud 透传 → 前端 `device-session.tsx` SSE handler
- **历史消息加载**：`loadMessages()` → cs-cloud 代理 → csc `GET /session/:id/message` → `transcriptReader.ts` 读 JSONL → 前端 `device-session.tsx:loadMessages`

### 7.1 两条路径的数据格式差异

| 维度 | SSE 实时推送 | 历史消息加载 |
|------|-------------|-------------|
| **数据来源** | `sessionMessageRouter.ts` 实时翻译 | `transcriptReader.ts` 读 JSONL 文件 |
| **消息 ID** | `randomUUID()` 临时生成 | JSONL 中的原始 uuid |
| **compact boundary** | compaction part（type: "compaction"） | **被截断跳过**，不返回前端 |
| **compact summary 角色** | assistant（`summary: true, mode: "compaction"`） | **user**（JSONL 中是 `UserMessage`） |
| **compact summary 标记** | `summary: true` | **无此标记** |
| **续接消息** | 有（synthetic text part） | **无**（csc 内部不生成此消息） |
| **消息结构** | opencode 格式（info + parts 分离） | csc 格式（uuid + role + content） |

### 7.2 具体不一致场景

#### 场景 1：刷新页面后的摘要角色退化

SSE 推送时，summary 是 `role: "assistant", summary: true`，前端渲染为 assistant 摘要卡片。

历史加载时，`transcriptReader.ts` 从 JSONL 读到 `type: "user"` 的 compact summary 消息（csc 内部 `CompactionResult.summaryMessages` 就是 `UserMessage[]`）。`entryToSessionMessage` 返回 `role: "user"`，前端将其渲染为用户消息气泡——角色从 assistant 退化为 user。

#### 场景 2：压缩标记丢失

SSE 推送时，有 compaction part 标记压缩边界。

历史加载时，`readSessionMessages`（`transcriptReader.ts:451-462`）找到 `compact_boundary` 后直接从下一行开始截取，compact boundary 本身不返回。前端无法知道会话经历过压缩。

#### 场景 3：续接消息消失

SSE 推送的续接消息是 `sessionMessageRouter` 临时生成的，不写入 JSONL。刷新后续接消息消失。

#### 场景 4：消息 ID 不匹配

SSE 推送的消息 ID 是临时的，历史加载的 ID 是 JSONL 原始的。如果前端在同一会话中先收到 SSE 推送再刷新拉取历史，两套 ID 完全不同，前端视为两套独立消息。

### 7.3 结论

仅改 `sessionMessageRouter.ts` 无法保证一致性——SSE 实时推送的改动不影响 JSONL 内容，历史加载读取的是 JSONL 原始数据。需要同步适配 `transcriptReader.ts`。

---

## 八、历史加载路径适配设计

### 8.1 改动范围

`csc/src/server/transcriptReader.ts` 的 `readSessionMessages` 和 `decomposeMessageToParts` 函数。

### 8.2 设计思路

`transcriptReader.ts` 已经知道 `compact_boundary` 的位置（line 451-462）。当前逻辑是截断 boundary 之前的消息、丢弃 boundary 本身。适配方案是：**在返回结果中注入与 SSE 路径等价的消息结构**。

### 8.3 详细设计

#### 改动 5：在历史加载结果中注入 compaction 消息

**文件**: `csc/src/server/transcriptReader.ts`
**函数**: `readSessionMessages` (当前 line 433)

在 `readSessionMessages` 中，截取 compact boundary 之后的消息后，根据 boundary entry 的元数据，在返回结果前注入：

```
注入序列:
① user message (承载 compaction，role="user")
② compaction part (type="compaction")
③ assistant message (role="assistant", summary=true, mode="compaction")
④ text part (摘要正文)

然后接上原有的 boundary 后续消息
```

**摘要正文来源**：boundary 之后的第一个 user 类型消息（即 compact summary）。从 `messages` 列表中识别并提取，将其角色转为 assistant、注入 summary 标记后从原位置移除。

**具体步骤**：

```
1. 找到 lastCompactBoundaryIndex 和对应的 boundary entry
2. 解析 boundary 之后的消息列表（已有逻辑）
3. 遍历消息列表，找到 compact summary 消息：
   - 判断条件：boundary 后第一条 user 消息，且 content 为纯文本摘要
   - 识别方式：该消息的 parentUuid 指向 boundary entry 的 uuid，
     或者 boundary 后的第一条 user 消息且 content 不含 tool_result
4. 构造注入消息：
   a. user message (承载 compaction) → 使用 boundary 的 uuid 作为 messageID
   b. compaction part → type="compaction", auto=从 compactMetadata 提取
   c. assistant summary → 使用 summary 消息的 uuid，role 改为 "assistant"，添加 summary=true
   d. text part → 从 summary 消息的 content 提取文本
5. 将 compact summary 消息从原列表中移除（已转化为 assistant summary）
6. 将注入消息追加到最终结果的前部
```

**compact summary 识别的可靠性**：

csc 的 `buildPostCompactMessages` 产出顺序为 `[boundaryMarker, summaryMessages, messagesToKeep, ...]`。在 JSONL 中，boundary 后紧跟的就是 summary messages（`type: "user"`）。`transcriptReader` 读到的第一条 user 消息就是 summary。但需要区分 summary 和 `messagesToKeep` 中的普通 user 消息。

可靠识别方式：compact summary 消息的 `parentUuid` 指向 boundary 的 uuid，而 `messagesToKeep` 中的消息保留 pre-compact 的 parentUuid。通过检查 boundary 后消息的 parentUuid 是否等于 boundary.uuid 来区分。

#### 改动 6：前端 `loadMessages` 格式适配

**文件**: `csc/src/server/transcriptReader.ts`
**函数**: `decomposeMessageToParts` 或新的序列化函数

当前 `GET /session/:id/message` 返回的格式：
```json
{ "messages": [{ "uuid": "...", "role": "user", "content": "...", "parts": [...] }] }
```

前端 `device-session.tsx:loadMessages` 期望的格式：
```json
{ "messages": [{ "info": { "id": "...", "role": "user", ... }, "parts": [...] }] }
```

需要确认 cs-cloud 的 `handleConversationMessages`（`proxy_handler_docs.go:124`，实际调用 `s.handleProxy`）是直接透传 csc 响应还是有格式转换。

- 如果透传：前端需要能处理 csc 的 `{ uuid, role, content, parts }` 格式
- 如果有转换：cs-cloud 需要同步适配 compact 相关的格式转换

**建议**：在 `transcriptReader.ts` 的返回格式中直接对齐前端期望的 `{ info, parts }` 结构，或由 cs-cloud 的代理层做一次轻量转换。

### 8.4 不需要处理的差异

**续接消息**：历史加载时不需要注入续接消息。续接消息只在实时压缩时用于驱动 agent 继续工作，历史场景下会话已结束，无此需求。

**消息 ID 不匹配**：前端 `loadMessages` 会完全替换 SSE 推送的消息列表（通过 `produce` 替换或合并）。只要历史加载的消息结构正确，ID 不同不会造成问题。

### 8.5 改动后的两条路径对比

| 维度 | SSE 实时推送 | 历史消息加载（改动后） | 一致性 |
|------|-------------|----------------------|--------|
| compact boundary | compaction part | compaction part（注入） | ✅ |
| summary 角色 | assistant, summary=true | assistant, summary=true（角色转换） | ✅ |
| summary 标记 | mode="compaction" | mode="compaction"（注入） | ✅ |
| 摘要正文 | text part | text part（从 JSONL 提取） | ✅ |
| 续接消息 | 有 | 无 | ⚠️ 可接受（历史会话无需续接） |
| 消息 ID | 临时 UUID | JSONL 原始 UUID | ⚠️ 不同但可接受（前端全量替换） |

---

## 九、完整文件改动清单（更新）

| 仓库 | 文件 | 改动类型 | 说明 |
|------|------|---------|------|
| csc | `src/server/sessionMessageRouter.ts` | 修改 | SSE 路径：完善 `emitCompactionEvent`，`handleUserMessage` 新增 `isCompactSummary` 拦截，`handleResultMessage` 新增续接消息 |
| csc | `src/server/transcriptReader.ts` | 修改 | 历史加载路径：`readSessionMessages` 注入 compaction 消息，compact summary 角色转换 |
| cs-cloud | `internal/agent/csc/adapter_sse_message.go` | 修改 | 移除 line 18-32 的 `compact_boundary` 独立处理 |
| app-ai-native | 无 | - | 前端消费端不需要改动 |
