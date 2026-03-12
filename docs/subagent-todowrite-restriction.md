# 为什么 Subagent 不能调用 TodoWrite 工具

## 问题概述

在 opencode 系统中，通过 `Task` 工具创建的 subagent 默认无法调用 `TodoWrite` 工具。这是通过权限系统强制执行的。

## 核心原因

### 1. Task 工具的硬编码权限限制

在 `packages/opencode/src/tool/task.ts:76-85` 中，创建 subagent session 时会显式设置权限规则：

```typescript
permission: [
  {
    permission: "todowrite",
    pattern: "*",
    action: "deny",
  },
  {
    permission: "todoread",
    pattern: "*",
    action: "deny",
  },
  // ...
]
```

### 2. 工具级别的权限检查

在 `packages/opencode/src/tool/todo.ts:12-17` 中，`TodoWriteTool` 执行前会检查权限：

```typescript
async execute(params, ctx) {
  await ctx.ask({
    permission: "todowrite",
    patterns: ["*"],
    always: ["*"],
    metadata: {},
  })
  // ...
}
```

由于 subagent 的权限规则中 `todowrite` 被设置为 `deny`，这个权限检查会失败。

### 3. 工具可见性控制

在 `packages/opencode/src/tool/task.ts:136-141` 中，创建 session 时还会从工具列表中移除 todo 工具：

```typescript
tools: {
  todowrite: false,
  todoread: false,
  // ...
}
```

这确保 subagent 根本看不到这些工具。

## 设计意图

这种限制是有意为之的设计决策：

1. **避免任务追踪混乱**：TodoWrite 用于跟踪主 agent 的任务进度。如果 subagent 也能修改 todo list，会导致任务状态混乱。

2. **职责分离**：Subagent 专注于执行特定子任务，不应管理整体任务进度。

3. **防止循环依赖**：避免 subagent 创建 todo item，然后又去执行自己创建的 todo。

## 如何让 Subagent 调用 TodoWrite

### 方法 1：修改 Agent 配置（推荐）

在 agent 定义中显式允许 `todowrite` 权限。例如，在 `packages/opencode/src/plugin/tdd/agents/test-design.ts:38` 中：

```typescript
permission: PermissionNext.merge(
  defaults,
  PermissionNext.fromConfig({
    question: "allow",
    todowrite: "allow",  // 显式允许
    todoread: "allow",
    bash: "deny",
  }),
  user,
),
```

### 方法 2：通过 Task 工具的权限继承

在 `packages/opencode/src/tool/task.ts:86-94` 中，如果 agent 本身有 `task` 权限，可以嵌套调用 Task：

```typescript
const hasTaskPermission = agent.permission.some((rule) => rule.permission === "task")

// 如果 agent 有 task 权限，就可以创建自己的 subagent
// 这些 subagent 也会被拒绝 todowrite 权限
```

### 方法 3：用户配置覆盖

用户可以在配置文件中为特定 agent 设置权限：

```json
{
  "permission": {
    "agent.TestDesign": {
      "todowrite": "allow"
    }
  }
}
```

## 相关代码位置

- **Task 工具权限设置**: `packages/opencode/src/tool/task.ts:76-85`
- **工具可见性控制**: `packages/opencode/src/tool/task.ts:136-141`
- **TodoWrite 工具定义**: `packages/opencode/src/tool/todo.ts:6-31`
- **默认 agent 权限**: `packages/opencode/src/agent/agent.ts:126-167`
- **TDD agents 权限示例**: `packages/opencode/src/plugin/tdd/agents/test-design.ts:38`

## 测试验证

在 `packages/opencode/test/plugin/tdd/agents/agent-permissions.test.ts:13,26,38,50` 中，有验证 TDD agents 是否正确配置了 `todowrite` 权限的测试：

```typescript
expect(agent.permission.todowrite).toBe("allow")
```

## 总结

Subagent 默认不能调用 TodoWrite 是通过多层权限控制实现的：

1. Session 级别的权限规则（deny）
2. 工具可见性控制（从工具列表中移除）
3. 工具执行时的权限检查

要让 subagent 能够使用 TodoWrite，需要在 agent 配置中显式允许该权限，但通常不建议这样做，因为这违背了任务追踪的设计初衷。
