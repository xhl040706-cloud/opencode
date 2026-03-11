# Subagent 权限配置指南

## 概述

本文档介绍如何为 OpenCode 的 subagent 开启 `todowrite`（待办事项写入）权限。

## 权限默认值

当一个 subagent 被调用时，系统会为其设置默认的权限规则：

- `todowrite` - **默认拒绝** (`deny`)
- `todoread` - **默认拒绝** (`deny`)
- `task` - **默认拒绝** (`deny`) - 除非 agent 本身配置了 task 权限

这意味着默认情况下，subagent 无法读写待办事项列表。

## 权限值说明

权限字段支持三种值：

| 值 | 说明 |
|---|---|
| `` | 允许执行，无需用户确认 |
| `deny` | 拒绝执行 |
| `ask` | 每次执行前询问用户确认 |

## 开启 todowrite 权限

### 方式一：创建 Agent 时配置

在创建 agent 时，通过 `permission` 字段显式设置 `todowrite` 为 `"allow"`：

```typescript
export async function createMyAgent(_: string): Promise<Config.Agent & { name: AgentName }> {
  return {
    name: MY_AGENT_NAME,
    description: "My custom subagent",
    mode: "subagent",
    permission: {
      todowrite: "allow",    // 允许写入待办事项
      todoread: "allow",     // 允许读取待办事项
      question: "allow",     // 允许提问
      read: "allow",         // 允许读取文件
      glob: "allow",         // 允许文件搜索
      grep: "allow",         // 允许内容搜索
      write: "allow",        // 允许写入文件
      task: "deny",          // 禁止调用其他 subagent
    }
  }
}
```

### 方式二：查看现有配置示例

项目中的 TDD plugin 提供了完整的配置示例，可以参考：

- [`packages/opencode/src/plugin/tdd/agents/test-prepare.ts`](../packages/opencode/src/plugin/tdd/agents/test-prepare.ts)
- [`packages/opencode/src/plugin/tdd/agents/test-design.ts`](../packages/opencode/src/plugin/tdd/agents/test-design.ts)
- [`packages/opencode/src/plugin/tdd/agents/test-and-fix.ts`](../packages/opencode/src/plugin/tdd/agents/test-and-fix.ts)

这些 agent 都配置了完整的权限列表：

```typescript
permission: {
  question: "allow",
  todowrite: "allow",
  todoread: "allow",
  read: "allow",
  glob: "allow",
  grep: "allow",
  write: "allow",
  task: "deny",
  bash: "deny"
}
```

## 相关代码位置

- 权限配置定义：[`packages/opencode/src/config/config.ts` (第695-696行)](../packages/opencode/src/config/config.ts)
- Subagent 会话创建：[`packages/opencode/src/tool/task.ts` (第75-100行)](../packages/opencode/src/tool/task.ts)
- TodoWrite 工具定义：[`packages/opencode/src/tool/todo.ts`](../packages/opencode/src/tool/todo.ts)
