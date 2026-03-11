# 自定义 SubAgent 设置 permission.todowrite 后模型仍无工具的原因分析

## 问题描述

用户为自定义 SubAgent 配置了：
```typescript
permission: {
  todowrite: "allow",
}
```

但发送消息给模型时，模型仍然看不到 `TodoWrite` 工具。

## 根本原因

**`permission` 配置和 `tools` 配置是兩個完全不同的概念，它们控制不同的层面。**

### 权限系统架构

OpenCode 的权限系统分为两层：

| 层级 | 配置字段 | 作用 |
|------|----------|------|
| 工具可见性 | `tools` 参数 | 控制哪些工具会出现在发送给模型的工具列表中 |
| 运行时权限 | `permission` 参数 | 控制工具执行时是否需要用户确认 |

### 关键代码位置

在 [`packages/opencode/src/tool/task.ts:126-131`](packages/opencode/src/tool/task.ts#L126) 中，当通过 `Task` 工具创建 subagent 时：

```typescript
const result = await SessionPrompt.prompt({
  // ...其他参数
  tools: {
    todowrite: false,     // 硬编码为 false
    todoread: false,      // 硬编码为 false
    ...(hasTaskPermission ? {} : { task: false }),
    ...Object.fromEntries((config.experimental?.primary_tools ?? []).map((t) => [t, false])),
  },
  parts: promptParts,
})
```

**这里是硬编码将 `todowrite` 设置为 `false`，无论 agent 的 `permission` 如何配置，这个设置都会覆盖用户配置。**

### permission 的实际作用

`permission` 配置（来自 [`packages/opencode/src/agent/agent.ts:35`](packages/opencode/src/agent/agent.ts#L35)）定义在 [`packages/opencode/src/permission/next.ts:42-45`](packages/opencode/src/permission/next.ts#L42) 中：

```typescript
export const Ruleset = Rule.array()
```

它是一个**规则数组**，每个规则包含：
- `permission`: 权限名称（如 `todowrite`）
- `pattern`: 匹配模式（默认 `"*"`）
- `action`: 动作为 `allow`、`deny` 或 `ask`

`permission` 配置的真正作用是：
1. 当 agent 调用工具时，系统会检查权限规则
2. 如果 `action` 是 `"ask"`，会弹出确认对话框
3. 如果 `action` 是 `"deny"`，工具执行会被阻止

**它并不控制工具是否可见，只控制工具执行时的行为。**

### TDD Agents 的特殊处理

项目中 TDD agents（如 [`test-design.ts`](packages/opencode/src/plugin/tdd/agents/test-design.ts)）配置了 `permission.todowrite: "allow"`，但这是为了让 subagent 在执行 TodoWrite 时**不需要用户确认**（即 `allow` 意味着"自动允许执行"），而不是为了让工具可见。

## 为什么现有文档有误导性

现有文档（如 [`subagent-todowrite-permission.md`](docs/agents/subagent-todowrite-permission.md)）声称可以通过设置 `permission.todowrite: "allow"` 来开启 subagent 的 TodoWrite 权限，但这是不准确的描述：

1. **文档没有区分"工具可见性"和"运行时权限"**
2. **即使 permission 设置正确，tools 参数仍然被硬编码覆盖**
3. **用户期望的是工具可见，但实际上 permission 只影响运行时行为**

## 设计意图分析

从代码可以看出，subagent 的 `todowrite` 和 `todoread` 工具被硬编码禁用是有意设计：

```typescript
tools: {
  todowrite: false,  // 强制禁用
  todoread: false,   // 强制禁用
}
```

这背后的设计考虑：
1. **避免任务追踪混乱**：TodoWrite 用于跟踪主 agent 的任务进度，如果 subagent 也能修改 todo list，会导致状态混乱
2. **职责分离**：Subagent 专注于执行特定子任务，不应管理整体任务进度
3. **防止循环依赖**：避免 subagent 创建 todo item 后又去执行自己创建的 todo

## 当前可行的方案

### 方案一：修改代码（推荐）

修改 [`packages/opencode/src/tool/task.ts`](packages/opencode/src/tool/task.ts)，让 tools 配置读取 agent 的 permission 设置：

```typescript
// 从 agent.permission 中读取允许的工具列表
const allowedTools = agent.permission
  .filter(rule => rule.action === "allow")
  .map(rule => rule.permission)

tools: {
  todowrite: allowedTools.includes("todowrite") ? true : false,
  todoread: allowedTools.includes("todoread") ? true : false,
  // ...
}
```

### 方案二：通过配置覆盖（临时方案）

修改全局配置 [`config.experimental.primary_tools`](packages/opencode/src/config/config.ts)：

```json
{
  "experimental": {
    "primary_tools": ["todowrite", "todoread"]
  }
}
```

但这会影响所有 agent，不是针对特定 subagent。

### 方案三：用户直接调用（替代方案）

让用户直接在主 agent 中使用 `@agent_name` 调用 subagent，而不是通过 `Task` 工具，这样可以绕过硬编码限制。

## 总结

| 问题 | 说明 |
|------|------|
| 现象 | 设置 `permission.todowrite` 后模型仍无工具 |
| 原因 | `permission` 控制运行时权限，`tools` 控制工具可见性，后者被硬编码为 `false` |
| 代码位置 | `packages/opencode/src/tool/task.ts:126-131` |
| 解决方案 | 需要修改代码，让 tools 配置读取 agent 的 permission 设置 |

这个问题反映了权限系统设计上的不一致性：permission 配置应该同时影响工具可见性和运行时行为，但目前只影响了后者。
