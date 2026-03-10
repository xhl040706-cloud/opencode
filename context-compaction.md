# OpenCode 上下文压缩 (Compaction) 机制

## 概述

OpenCode 的上下文压缩机制用于管理对话历史，防止对话超过模型的上下文窗口限制。

## 配置

```json
{
  "$schema": "https://opencode.ai/config.json",
  "compaction": {
    "auto": true,
    "prune": true,
    "reserved": 20000
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `auto` | boolean | `true` | 当上下文已满时自动压缩会话 |
| `prune` | boolean | `true` | 删除旧工具输出以节省 Tokens |
| `reserved` | number | `20000` | 自定义保留缓冲区大小（tokens） |

---

## 核心机制

### 1. 溢出检测

```
源文件: packages/opencode/src/session/compaction.ts
```

每次消息处理后检查是否需要压缩：

```typescript
const COMPACTION_BUFFER = 20_000
```

**计算逻辑**：

```
可用上下文 = 模型上下文限制 - 最大输出 tokens - 保留缓冲区
```

当 `已用 tokens >= 可用上下文` 时触发压缩。

**保留缓冲区**：
- 默认：`20,000` tokens
- 或：`min(20000, maxOutputTokens)` 取较小值
- 可通过 `reserved` 配置自定义

---

### 2. 修剪 (Pruning)

主动清理机制，在每次消息处理后运行。

**常量定义**：

```typescript
const PRUNE_MINIMUM = 20_000  // 至少累积这么多才执行修剪
const PRUNE_PROTECT = 40_000  // 保护最近 40k tokens 的工具输出
const PRUNE_PROTECTED_TOOLS = ["skill"]  // 永不修剪的工具
```

**修剪算法**：

1. 从最新消息**倒序遍历**
2. 保护最近 **2 个对话轮次** 的工具输出
3. 遇到 `summary` 消息时停止（已被压缩过）
4. 累积工具输出的 token 数量
5. 超过 `PRUNE_PROTECT` (40k) 之后的旧工具输出会被标记为 `compacted`
6. 至少累积 `PRUNE_MINIMUM` (20k) tokens 才真正执行修剪

**保护规则**：
- 最近 2 轮对话的输出完全保留
- `skill` 工具的输出永远不会被修剪

---

### 3. 压缩处理

当触发压缩时的处理流程。

#### 3.1 确定压缩边界

从当前用户消息往前查找第一个未被压缩的用户消息：

```
当前消息 ← ... ← [找到第一个未压缩的消息] ← 压缩开始点
```

#### 3.2 生成摘要

使用专用的 `compaction` agent 调用 LLM 生成对话摘要。

**摘要模板**：

```markdown
## Goal

[用户试图实现的目标是什么？]

## Instructions

- [用户给出的相关重要指令]
- [如果有计划或规格说明，包含相关信息以便下一个代理继续使用]

## Discoveries

[对话过程中学到的重要信息，对下一个代理继续工作有帮助]

## Accomplished

[已完成的工作、进行中的工作和待完成的工作]

## Relevant files / directories

[已读取、编辑或创建的相关文件结构化列表]
```

#### 3.3 处理结果

| 结果 | 操作 |
|------|------|
| 摘要成功 | 插入摘要消息，重放用户消息继续 |
| 媒体文件过大 | 删除媒体后重新尝试 |
| 仍然溢出 | 停止并报错 |

---

## 完整流程图

```
消息完成
    ↓
检查是否溢出?
    ├─ 否 → 返回正常流程
    ↓ 是
运行 prune()
    ├─ 倒序遍历消息
    ├─ 保护最近 2 轮对话
    ├─ 累积旧工具输出
    └─ 标记超过 40k tokens 的输出为 compacted
    ↓
创建压缩任务
    ↓
LLM 生成对话摘要 (使用 compaction agent)
    ↓
摘要成功?
    ├─ 否 → 尝试删除媒体后重试
    │         ↓
    │      仍然太大?
    │         ├─ 是 → 停止报错
    │         └─ 否 → 继续
    ↓ 是
插入摘要消息
    ↓
auto 配置?
    ├─ 是 → 重放用户消息继续对话
    └─ 否 → 等待用户输入
```

---

## 消息状态

消息可能有以下状态：

| 状态 | 说明 |
|------|------|
| 正常 | 完整保留 |
| `compacted` | 工具输出已被清空（仅保留元数据） |
| `summary` | 这是一个压缩摘要消息 |

---

## 相关文件

- **源代码**: `packages/opencode/src/session/compaction.ts`
- **配置文档**: https://opencode.ai/docs/zh-cn/config

---

## 注意事项

1. **不可逆操作**：压缩后原始消息内容无法恢复
2. **媒体处理**：大文件会被优先移除
3. **插件扩展**：可以通过 `experimental.session.compacting` 钩子自定义压缩行为
