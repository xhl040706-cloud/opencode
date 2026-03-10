# OpenCode 工程中的 Tools 列表

本文档记录了 OpenCode 工程中所有可用的 Tools 及其功能说明。

## 核心文件操作 Tools

### 1. read

- **描述**: 读取文件或目录内容
- **参数**:
  - `filePath`: 要读取的文件或目录的绝对路径
  - `offset`: 开始读取的行号（1-indexed，可选）
  - `limit`: 读取的最大行数（默认 2000，可选）
- **功能**:
  - 读取文件内容，支持分页读取
  - 读取目录内容，显示文件列表
  - 自动检测并处理二进制文件
  - 支持读取图片和 PDF 文件（作为附件返回）
- **限制**:
  - 默认读取 2000 行
  - 单行最大 2000 字符
  - 最大 50KB 内容

### 2. write

- **描述**: 写入文件内容
- **参数**:
  - `filePath`: 要写入的文件的绝对路径
  - `content`: 要写入的内容
- **功能**:
  - 创建新文件或覆盖已有文件
  - 自动触发 LSP 诊断
  - 发布文件更新事件
- **权限**: 需要 `edit` 权限

### 3. edit

- **描述**: 编辑文件内容，替换指定文本
- **参数**:
  - `filePath`: 要修改的文件的绝对路径
  - `oldString`: 要替换的文本
  - `newString`: 替换后的文本（必须与 oldString 不同）
  - `replaceAll`: 替换所有匹配项（默认 false，可选）
- **功能**:
  - 支持多种匹配策略：
    - 精确匹配
    - 行修剪匹配
    - 块锚点匹配
    - 空白规范化匹配
    - 缩进灵活匹配
    - 转义规范化匹配
    - 多出现匹配
    - 边界修剪匹配
    - 上下文感知匹配
  - 自动生成 diff
  - LSP 错误检测
- **权限**: 需要 `edit` 权限

### 4. multiedit

- **描述**: 在单个文件上执行多个编辑操作
- **参数**:
  - `filePath`: 要修改的文件的绝对路径
  - `edits`: 编辑操作数组，每个操作包含 filePath, oldString, newString, replaceAll
- **功能**:
  - 顺序执行多个编辑操作
  - 复用 edit tool 的所有匹配策略
- **权限**: 需要 `edit` 权限

### 5. apply_patch

- **描述**: 应用 patch 文件格式的变更
- **参数**:
  - `patchText`: 完整的 patch 文本
- **功能**:
  - 支持 add、update、delete、move 操作
  - 自动验证 patch 格式
  - 批量应用文件变更
  - LSP 错误检测
- **权限**: 需要 `edit` 权限

## 文件搜索 Tools

### 6. glob

- **描述**: 使用 glob 模式匹配文件
- **参数**:
  - `pattern`: glob 匹配模式
  - `path`: 搜索目录（可选，默认当前工作目录）
- **功能**:
  - 快速文件模式匹配
  - 按修改时间排序
  - 限制返回 100 个结果
- **权限**: 需要 `glob` 权限

### 7. grep

- **描述**: 在文件内容中搜索正则表达式
- **参数**:
  - `pattern`: 正则表达式搜索模式
  - `path`: 搜索目录（可选，默认当前工作目录）
  - `include`: 文件类型过滤（如 "_.js", "_.{ts,tsx}"，可选）
- **功能**:
  - 使用 ripgrep 进行高效搜索
  - 支持正则表达式
  - 按修改时间排序结果
  - 限制返回 100 个匹配
- **权限**: 需要 `grep` 权限

### 8. codesearch

- **描述**: 搜索代码上下文，用于查找 API、库和 SDK 的相关文档
- **参数**:
  - `query`: 搜索查询
  - `tokensNum`: 返回的 token 数（1000-50000，默认 5000）
- **功能**:
  - 搜索代码片段和文档
  - 返回相关代码上下文
  - 支持调整返回内容量
- **权限**: 需要 `codesearch` 权限

### 9. list

- **描述**: 列出目录内容（已弃用，建议使用 read 工具）
- **参数**:
  - `path`: 要列出的目录绝对路径（可选）
  - `ignore`: 忽略的 glob 模式数组（可选）
- **功能**:
  - 生成目录树结构
  - 自动忽略常见目录（node_modules, .git 等）
  - 限制返回 100 个文件
- **权限**: 需要 `list` 权限

## 命令执行 Tools

### 10. bash

- **描述**: 执行 shell 命令
- **参数**:
  - `command`: 要执行的命令
  - `timeout`: 超时时间（毫秒，可选）
  - `workdir`: 工作目录（可选，默认项目目录）
  - `description`: 命令描述（5-10 个词）
- **功能**:
  - 执行 shell 命令
  - 解析命令以检测文件操作
  - 自动请求权限
  - 支持超时控制
  - 输出截断（最大 30000 行，10MB）
- **权限**: 需要 `bash` 和 `external_directory` 权限（根据命令类型）

### 11. lsp

- **描述**: 执行 LSP（语言服务器协议）操作
- **参数**:
  - `operation`: LSP 操作类型
    - `goToDefinition`: 跳转到定义
    - `findReferences`: 查找引用
    - `hover`: 悬停提示
    - `documentSymbol`: 文档符号
    - `workspaceSymbol`: 工作区符号
    - `goToImplementation`: 跳转到实现
    - `prepareCallHierarchy`: 准备调用层次
    - `incomingCalls`: 调用者
    - `outgoingCalls`: 被调用者
  - `filePath`: 文件路径（绝对或相对）
  - `line`: 行号（1-based）
  - `character`: 字符偏移（1-based）
- **功能**:
  - 调用 LSP 服务器进行代码分析
  - 支持定义跳转、引用查找、符号搜索等
  - 返回 JSON 格式的结果
- **权限**: 需要 `lsp` 权限

## 任务管理 Tools

### 12. task

- **描述**: 启动子 Agent 执行任务
- **参数**:
  - `description`: 任务简短描述（3-5 个词）
  - `prompt`: Agent 要执行的任务
  - `subagent_type`: 要使用的 Agent 类型
  - `task_id`: 恢复之前的任务（可选）
  - `command`: 触发此任务的命令（可选）
- **功能**:
  - 创建新的子 Agent 会话
  - 将任务分发给指定的 Agent
  - 支持恢复之前的任务
  - 返回任务结果
- **权限**: 需要 `task` 权限

### 13. todowrite

- **描述**: 更新待办事项列表
- **参数**:
  - `todos`: 更新后的待办事项列表
- **功能**:
  - 写入待办事项
  - 跟踪任务进度
- **权限**: 需要 `todowrite` 权限

### 14. todoread

- **描述**: 读取待办事项列表
- **参数**: 无
- **功能**:
  - 读取当前待办事项
  - 返回 JSON 格式的待办列表
- **权限**: 需要 `todoread` 权限

### 15. question

- **描述**: 向用户提问
- **参数**:
  - `questions`: 问题数组
- **功能**:
  - 向用户展示问题
  - 收集用户答案
  - 支持多种问题类型（单选、多选、文本输入）
- **权限**: 无需权限

## 网络访问 Tools

### 16. webfetch

- **描述**: 获取 URL 内容
- **参数**:
  - `url`: 要获取内容的 URL
  - `format`: 返回格式（text/markdown/html，默认 markdown）
  - `timeout`: 超时时间（秒，可选，最大 120）
- **功能**:
  - 获取网页内容
  - 支持多种格式转换
  - 自动处理图片和 PDF
  - 最大响应大小 5MB
- **权限**: 需要 `webfetch` 权限

### 17. websearch

- **描述**: 执行网络搜索
- **参数**:
  - `query`: 搜索查询
  - `numResults`: 返回结果数（默认 8，可选）
  - `livecrawl`: 实时抓取模式（fallback/preferred，可选）
  - `type`: 搜索类型（auto/fast/deep，可选）
  - `contextMaxCharacters`: 上下文最大字符数（可选）
- **功能**:
  - 执行网络搜索
  - 支持实时抓取
  - 可调整搜索深度和结果数量
- **权限**: 需要 `websearch` 权限

### 18. skill

- **描述**: 加载专业技能
- **参数**:
  - `name`: 技能名称
- **功能**:
  - 加载领域特定的技能
  - 注入详细指令和工作流
  - 提供访问捆绑资源的能力
- **权限**: 需要 `skill` 权限

## Costrict 专用 Tools

### 19. checkpoint

- **描述**: 创建和管理项目快照
- **参数**:
  - `action`: 操作类型
    - `commit`: 创建快照
    - `list`: 列出所有快照
    - `show_diff`: 显示快照差异
    - `restore`: 恢复快照
    - `revert`: 回滚快照
  - `message`: 提交消息（commit 时必需）
  - `commit_hash`: 提交哈希（restore/show_diff/revert 时必需）
  - `files`: 要恢复的文件路径列表（restore 时可选）
- **功能**:
  - 创建项目快照
  - 列出所有快照
  - 查看快照差异
  - 恢复到指定快照
  - 回滚快照变更
- **依赖**: 需要 Git

### 20. sequential-thinking

- **描述**: 结构化思考工具，用于复杂问题的分步骤分析
- **参数**:
  - `thought`: 当前思考步骤的内容
  - `thoughtNumber`: 当前步骤编号（从 1 开始）
  - `totalThoughts`: 预计总步骤数（可动态调整）
  - `nextThoughtNeeded`: 是否需要更多思考步骤
  - `isRevision`: 是否是对之前思考的修订（可选）
  - `revisesThought`: 要修订的思考编号（可选）
  - `branchFromThought`: 从哪个思考创建分支（可选）
  - `branchId`: 分支标识符（可选）
  - `needsMoreThoughts`: 是否需要超出预计的更多思考（可选）
- **功能**:
  - 分步骤思考
  - 动态调整总步骤数
  - 支持修订之前的思考
  - 支持创建替代方案分支
  - 根据复杂度设置 5-25 个步骤

### 21. file-outline

- **描述**: 提取代码文件的结构信息
- **参数**:
  - `file_path`: 要分析的文件路径
  - `include_docstrings`: 是否包含文档字符串（默认 true，可选）
- **功能**:
  - 提取类、函数、方法定义
  - 提取文档字符串
  - 返回定义的行号、签名和文档
- **支持语言**:
  - Python (.py)
  - JavaScript (.js, .jsx)
  - TypeScript (.ts, .tsx)
  - Go (.go)
  - Java (.java)
  - C (.c, .h)
  - C++ (.cpp, .hpp)

### 22. file-importance

- **描述**: 分析代码文件的重要性
- **参数**:
  - `root_directory`: 要分析的根目录路径
  - `weights`: 自定义权重配置（可选）
    - `pagerank`: PageRank 权重
    - `usage`: 使用频率权重
    - `complexity`: 复杂度权重
    - `semantic`: 语义重要性权重
    - `git_history`: Git 历史权重
    - `size`: 文件大小权重
  - `top_n`: 返回前 N 个最重要的文件（可选）
  - `include_details`: 是否包含维度详情（默认 true，可选）
  - `include_patterns`: 包含的文件模式（glob，可选）
  - `exclude_patterns`: 排除的文件模式（glob，可选）
- **功能**:
  - 通过 6 个维度评估文件重要性
  - 返回按重要性排序的文件列表
  - 支持自定义权重配置
- **支持语言**: 与 file-outline 相同

### 23. call-graph

- **描述**: 分析代码的调用图和继承链
- **参数**:
  - `analysis_type`: 分析类型
    - `call_chain`: 函数调用链
    - `inheritance_chain`: 类继承链
  - `root_directory`: 要分析的根目录路径
  - `target_name`: 目标函数或类名
  - `chain_direction`: 链方向（callers/callees/both/parents/children，默认 both，可选）
  - `chain_depth`: 最大链深度（默认 3，可选）
  - `exact_match`: 是否精确匹配（默认 true，可选）
  - `include_patterns`: 包含的文件模式（可选）
  - `exclude_patterns`: 排除的文件模式（可选）
- **功能**:
  - 分析函数调用关系
  - 分析类继承关系
  - 支持双向链追踪
  - 可调整分析深度
- **支持语言**: 与 file-outline 相同

## 工具配置文件位置

所有 Tool 的配置文件位于：

- `packages/opencode/src/tool/*.ts` - 核心 Tools
- `packages/opencode/src/costrict/tool/*.ts` - Costrict 专用 Tools

## Tool 权限系统

OpenCode 使用权限系统控制 Tool 的访问：

- **read**: 读取文件权限
- **edit**: 编辑文件权限
- **glob**: 文件模式匹配权限
- **grep**: 内容搜索权限
- **bash**: 执行命令权限
- **external_directory**: 访问外部目录权限
- **webfetch**: 网络获取权限
- **websearch**: 网络搜索权限
- **codesearch**: 代码搜索权限
- **lsp**: LSP 操作权限
- **list**: 列出目录权限
- **task**: 启动子 Agent 权限
- **todowrite**: 写入待办事项权限
- **todoread**: 读取待办事项权限
- **skill**: 加载技能权限
- **question**: 提问权限（通常允许）
- **plan_enter**: 进入计划模式权限
- **plan_exit**: 退出计划模式权限

## 总结

OpenCode 工程共包含 **23 个 Tools**，分为以下几类：

1. **核心文件操作 Tools**（5 个）：read, write, edit, multiedit, apply_patch
2. **文件搜索 Tools**（4 个）：glob, grep, codesearch, list
3. **命令执行 Tools**（2 个）：bash, lsp
4. **任务管理 Tools**（4 个）：task, todowrite, todoread, question
5. **网络访问 Tools**（3 个）：webfetch, websearch, skill
6. **Costrict 专用 Tools**（5 个）：checkpoint, sequential-thinking, file-outline, file-importance, call-graph

每个 Tool 都有明确的参数、功能和权限要求，共同构成了完整的 AI 辅助开发工具体系。
