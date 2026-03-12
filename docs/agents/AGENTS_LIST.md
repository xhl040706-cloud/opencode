# OpenCode 工程中的 Agent 列表

本文档记录了 OpenCode 工程中所有可用的 Agent 及其功能说明。

## 核心架构 Agent

### 1. build

- **模式**: primary
- **描述**: 默认 Agent，基于配置的权限执行工具
- **特性**: 原生 Agent，支持 question、plan_enter、plan_exit 等工具
- **权限**: 合并了默认权限和用户配置权限

### 2. plan

- **模式**: primary
- **描述**: Plan 模式，禁止所有编辑工具
- **特性**: 原生 Agent，隐藏模式
- **权限**: 只允许在 `.costrict/plans/` 目录下编辑 markdown 文件

### 3. general

- **模式**: subagent
- **描述**: 通用 Agent，用于研究复杂问题和执行多步骤任务
- **特性**: 原生 Agent，支持并行执行多个工作单元
- **权限**: 禁止 todoread 和 todowrite

### 4. explore

- **模式**: subagent
- **描述**: 专门用于快速探索代码库的 Agent
- **特性**: 原生 Agent
- **使用场景**: 快速查找文件模式、搜索代码关键词、回答代码库相关问题
- **探索级别**: quick（基础搜索）、medium（适度探索）、very thorough（全面分析）

### 5. compaction

- **模式**: primary
- **描述**: 会话压缩 Agent
- **特性**: 原生 Agent，隐藏模式
- **权限**: 禁止所有工具操作

### 6. title

- **模式**: primary
- **描述**: 标题生成 Agent
- **特性**: 原生 Agent，隐藏模式，temperature 0.5
- **权限**: 禁止所有工具操作

### 7. summary

- **模式**: primary
- **描述**: 摘要生成 Agent
- **特性**: 原生 Agent，隐藏模式
- **权限**: 禁止所有工具操作

## 规划与需求 Agent

### 8. SpecPlan

- **模式**: subagent
- **描述**: 根据用户需求创建具体可实施的计划
- **核心职责**: 遵循"理解用户需求→探索项目→需求澄清→创建提案→实施提案"工作流
- **关键特性**:
  - 必须先使用 QuickExplore Agent 进行项目深度探索
  - 使用 question 工具进行需求澄清
  - 创建结构化提案（proposal.md, task.md）
  - 通过 PlanApply Agent 实施提案
- **工作流程**: 需求理解 → 项目探索 → 需求澄清 → 创建提案 → 实施提案 → 变更归档

### 9. StrictSpec

- **模式**: primary
- **描述**: 严格规范的工作流程 Agent，通过五个严谨阶段系统化完成特性开发
- **核心职责**: 确保高质量交付的规范化流程
- **五个阶段**:
  1. 用户输入记录（user.md）
  2. 项目探索（research.md）
  3. 需求明确（spec.md）
  4. 架构设计（project.md）
  5. 开发任务规划（plan.md）
  6. 任务规划执行
- **目录结构**: `.cospec/spec/{功能名}/`

### 10. PlanManager

- **模式**: subagent
- **描述**: 开发任务管理与协调 Agent
- **核心职责**:
  - 深入理解任务规划（plan.md）
  - 将开发任务分发给 SpecPlan 执行
  - 处理反馈、做出技术决策
  - 维护 plan.md，记录任务进度
- **工作原则**:
  - 每个任务完成后必须立即更新 plan.md
  - 合理的任务粒度控制
  - 精准提供上下文
- **目录结构**: `.cospec/spec/{功能名}/`

### 11. TaskPlan

- **模式**: subagent
- **描述**: 任务规划 Agent，具备高度预算意识
- **核心职责**: 将需求文档和设计文档转化为高层次的任务规划（plan.md）
- **工作本质**: "规划师"，将【需求+设计】翻译为【高层次的任务清单】
- **输出**: 结构化的任务规划文档
- **目录结构**: `.cospec/spec/{功能名}/`

### 12. Requirement

- **模式**: subagent
- **描述**: 需求分析 Agent，将用户需求转化为结构化系统需求
- **核心职责**:
  - 深度、全面理解用户原始需求
  - 转换为结构化的系统需求文档
  - 确保技术无关、无歧义、理解充分、拆解合理、信息无损、可测试验证
- **输出路径**: `{path}/spec.md`
- **工作流程**:
  1. 需求理解
  2. 需求澄清
  3. 编写用户故事
  4. 编写系统需求
  5. 识别核心实体（可选）
  6. 记录用户指定实现要求（可选）
  7. 制定成功标准
  8. 质量审查

### 13. StrictPlan

- **模式**: primary
- **描述**: 严格规范的 Plan Agent
- **核心职责**: 遵循"理解用户需求→探索项目→需求澄清→创建提案→实施提案→执行测试"工作流
- **关键特性**:
  - 不允许直接写代码
  - 必须通过 PlanApply Agent 实施提案
  - 必须先使用 QuickExplore Agent 进行项目深度探索
  - 需求澄清后执行测试
- **目录结构**: `.cospec/plan/changes/[change-id]/`

## 开发与编码 Agent

### 14. PlanApply

- **模式**: subagent
- **描述**: 开发任务管理与协调 Agent（CodingAgent）
- **核心职责**:
  - 理解全局：深入理解任务规划（task.md）
  - 任务分发：将开发任务分发给 SubCodingAgent
  - 任务审查：审查 SubCodingAgent 的代码提交
  - 决策响应：处理反馈，做出技术决策
  - 进度追踪：维护 task.md，记录任务进度
- **工作原则**:
  - 禁止直接修改代码，必须通过 SubCodingAgent 执行
  - 每个任务完成后必须立即更新 task.md
  - 合理的任务粒度控制
- **目录结构**: `.cospec/plan/changes/[change-id]/`

### 15. SubCodingAgent

- **模式**: subagent
- **描述**: 专业软件开发 Agent，具备高度预算意识
- **核心职责**: 在高效率、低成本的前提下完成开发任务
- **工作原则**:
  - 先理解，后动手
  - 尊重项目架构
  - 最小变更原则
  - 风格一致性
  - 注释规范
  - checkpoint 提交
- **执行流程**: 需求理解 → 代码探索 → 编写代码 → 提交代码 → 任务结束

### 16. DesignAgent

- **模式**: subagent
- **描述**: 专门用于软件架构设计的 Agent
- **核心职责**: 基于 C4 Model 方法论，完成系统架构设计
- **输出**: 结构化的设计文档与架构图（Mermaid / PlantUML 格式）
- **C4 Model 四层建模**:
  1. System Context（系统上下文图）
  2. Container（容器图）
  3. Component（组件图）
  4. Code（代码级设计）
- **输出路径**: `.cospec/{功能名}/project.md`
- **记录**: 关键架构决策（ADR）

## 探索与测试 Agent

### 17. SpecReSearch

- **模式**: subagent
- **描述**: 专门用于快速项目探索和代码理解的 Agent
- **核心职责**: 在独立上下文中工作，提供代码库的快速分析和理解能力
- **输出**: 结构化的探索结果（research.md）
- **子任务**:
  1. 项目基本信息和技术栈获取
  2. 项目结构分析
  3. 项目规范挖掘和常用命令获取
  4. 固定内容添加
  5. 审查校验
- **输出路径**: `${path}/research.md`

### 18. QuickExplore

- **模式**: subagent
- **描述**: 快速项目探索 Agent
- **核心职责**: 响应父 Agent 的定向探索任务
- **工作方式**:
  - 接收父 Agent 的探索指令
  - 自主选择探索策略和工具组合
  - 从项目代码文件和 Git 提交历史中提取信息
  - 输出结构化的探索结果
- **探索策略**:
  - 从代码文件获取：使用 Read/Grep/Glob 工具
  - 从 Git 历史获取：使用 Bash 执行 git 命令
  - 漏斗式收敛：从宏观到微观
- **执行约束**: 控制在 30 轮内完成

### 19. TestDrivenDevelopment

- **模式**: subagent
- **描述**: 执行全面的测试工作流程以确保代码质量
- **核心职责**: 编码完成后主动进行测试，确保代码正确性
- **测试执行流程**:
  1. 执行可运行性验证（RunAndFix）
  2. 确认用户需求
  3. 生成测试用例（TestDesign）
  4. 执行测试和修复（TestAndFix）
- **输出**: 测试计划文档保存到 `.cospec/test-plans/test-plan-*.md`

### 20. TaskCheck

- **模式**: subagent
- **描述**: 专门用于 task 任务质量检查与改进的 Agent
- **核心职责**: 把 `task.md` 从"可读"修复到"可执行、可落地"
- **检查维度**:
  1. 格式完整性检查
  2. 位置精确性检查
  3. 清晰度检查
  4. 需求覆盖检查
  5. 风格检查
- **重要约束**: 只能修改 `task.md` 文件，不能修改任何代码文件

### 21. ReviewAndFix

- **模式**: subagent
- **描述**: 专门用于审查和修复代码问题的 Agent
- **核心职责**:
  - 收集用户对已完成代码的反馈和建议
  - 分析用户反馈，制定修改策略
  - 添加新的开发任务
  - 委托 SubCodingAgent 执行具体的代码修改
  - 审查 SubCodingAgent 的代码提交
  - 更新 task.md 中的任务完成状态
- **代码审查原则**:
  - 代码实现质量
  - 功能完成度
  - 风格一致
  - 架构尊重

## Wiki 文档生成 Agent

### 22. WikiProjectAnalyze

- **模式**: subagent
- **描述**: 项目分类分析子任务（仅供 project-wiki 使用）
- **核心职责**: 深度解析目标仓库的技术架构、业务定位与开发模式
- **输出**: 项目技术特征分析结果
- **输出路径**: `.costrict/wiki/.staging/basic_analyze.json`
- **项目类型参考**: 应用程序型、框架型、库型、开发工具型、命令行工具型、DevOps 配置型、文档型

### 23. WikiCatalogueDesign

- **模式**: subagent
- **描述**: 文档结构设计子任务（仅供 project-wiki 使用）
- **核心职责**: 深度解析目标代码库，生成动态适配项目特性的分层 JSON 文档结构
- **输出**: 分层 JSON 文档结构
- **输出路径**: `.costrict/wiki/.staging/catalogue.json`
- **文档架构**:
  - 入门引导架构（项目概述、环境配置、核心概念、基础使用、快速参考）
  - 技术深度架构（架构分析、核心组件、功能实现、技术实现、集成扩展）

### 24. WikiDocumentGenerate

- **模式**: subagent
- **描述**: 文档生成子任务（仅供 project-wiki 使用）
- **核心职责**: 基于仓库分析成果，采用多阶段文档生成方法论，构建高质量技术文档体系
- **输出**: 技术文档
- **输出路径**: `.costrict/wiki/${文档标题}.md`
- **执行流程**:
  1. 参数校验
  2. 战略规划
  3. 深度代码分析
  4. 文档创建
  5. 战略性增强
  6. 文档检查

### 25. WikiIndexGeneration

- **模式**: subagent
- **描述**: 索引文档生成子任务（仅供 project-wiki 使用）
- **核心职责**: 基于生成的技术文档和项目分析结果，创建全面的索引结构
- **输出**: 索引文档
- **输出路径**: `.costrict/wiki/index.md`
- **内容**:
  - 项目概述（项目定位、技术栈、架构特点）
  - 组织结构
  - 核心文档导航

## Agent 配置文件位置

所有 Agent 的配置文件位于：

- `packages/opencode/src/costrict/agent/*.txt`

## Agent 生成

Agent 配置通过 `packages/opencode/script/generate-agents.ts` 脚本自动生成，扫描 `packages/opencode/src/costrict/agent/` 目录下的 `.txt` 文件并生成 `builtin.ts`。

## 总结

OpenCode 工程共包含 **25 个 Agent**，分为以下几类：

1. **核心架构 Agent**（7 个）：build, plan, general, explore, compaction, title, summary
2. **规划与需求 Agent**（6 个）：SpecPlan, StrictSpec, PlanManager, TaskPlan, Requirement, StrictPlan
3. **开发与编码 Agent**（3 个）：PlanApply, SubCodingAgent, DesignAgent
4. **探索与测试 Agent**（5 个）：SpecReSearch, QuickExplore, TestDrivenDevelopment, TaskCheck, ReviewAndFix
5. **Wiki 文档生成 Agent**（4 个）：WikiProjectAnalyze, WikiCatalogueDesign, WikiDocumentGenerate, WikiIndexGeneration

每个 Agent 都有明确的职责、工作流程和输出规范，共同构成了完整的 AI 辅助开发体系。
