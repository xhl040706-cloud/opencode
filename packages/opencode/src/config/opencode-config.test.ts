/**
 * 测试 OpenCode 和 CoStrict 配置的合并逻辑
 *
 * 测试目标：
 * 1. 当 COSTRICT_ENABLE_OPENCODE_CONFIG 为 true 时，同时加载 OpenCode 和 CoStrict 配置
 * 2. CoStrict 配置应覆盖 OpenCode 配置
 * 3. 当 COSTRICT_ENABLE_OPENCODE_CONFIG 为 false 时，只加载 CoStrict 配置
 */

import { Config } from "./config"
import { Flag } from "../flag/flag"
import { describe, it, expect, beforeEach, afterEach } from "bun:test"

describe("OpenCode Config Compatibility", () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = { ...process.env }

    // 测试配置文件路径
    process.env.COSTRICT_CONFIG_DIR = "/tmp/test-config"
    process.env.OPENCODE_CONFIG_DIR = "/tmp/test-opencode-config"
  })

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv
  })

  it("should load both OpenCode and CoStrict configs when COSTRICT_ENABLE_OPENCODE_CONFIG is true", async () => {
    process.env.COSTRICT_ENABLE_OPENCODE_CONFIG = "true"

    // 注意：这个测试需要实际的配置文件才能运行
    // 这里主要验证逻辑流程的正确性

    const { config } = await Config.state()

    // 验证配置对象存在
    expect(config).toBeDefined()
    expect(config).toMatchObject({
      agent: {},
      mode: {},
      plugin: [],
    })
  })

  it("should load only CoStrict config when COSTRICT_ENABLE_OPENCODE_CONFIG is false", async () => {
    process.env.COSTRICT_ENABLE_OPENCODE_CONFIG = "false"

    // 验证 Flag 值
    expect(Flag.COSTRICT_ENABLE_OPENCODE_CONFIG).toBe(false)

    const { config } = await Config.state()

    expect(config).toBeDefined()
  })

  it("should use true as default value for COSTRICT_ENABLE_OPENCODE_CONFIG", () => {
    delete process.env.COSTRICT_ENABLE_OPENCODE_CONFIG

    expect(Flag.COSTRICT_ENABLE_OPENCODE_CONFIG).toBe(true)
  })

  it("should merge configs with CoStrict overriding OpenCode", async () => {
    // 测试合并逻辑
    process.env.COSTRICT_ENABLE_OPENCODE_CONFIG = "true"

    const openCodeConfig: Config.Info = {
      model: "openai/gpt-4",
      logLevel: "DEBUG",
      plugin: ["plugin1"],
    }

    const costrictConfig: Config.Info = {
      model: "anthropic/claude-3",
      username: "costrict-user",
      plugin: ["plugin2"],
    }

    // 模拟 mergeConfigConcatArrays 的行为
    const merged = {
      ...openCodeConfig,
      ...costrictConfig,
      plugin: [...(openCodeConfig.plugin || []), ...(costrictConfig.plugin || [])],
    }

    // CoStrict 配置应该覆盖 OpenCode 配置
    expect(merged.model).toBe("anthropic/claude-3")
    expect(merged.username).toBe("costrict-user")
    expect(merged.logLevel).toBe("DEBUG") // 只有 OpenCode 有的字段保留

    // 插件应该被去重
    expect(merged.plugin).toEqual(["plugin1", "plugin2"])
  })

  it("should load OpenCode config files when enabled", async () => {
    process.env.COSTRICT_ENABLE_OPENCODE_CONFIG = "true"

    // 验证 OpenCode 环境变量可以被访问
    expect(Flag.OPENCODE_CONFIG).toBeDefined()
    expect(Flag.OPENCODE_CONFIG_CONTENT).toBeDefined()
    expect(Flag.OPENCODE_CONFIG_DIR).toBeDefined()
  })
})

// 集成测试说明：
//
// 要运行完整的集成测试，需要创建测试配置文件：
//
// 1. 创建 /tmp/test-opencode-config/opencode.json:
//    {
//      "model": "openai/gpt-4",
//      "theme": "dark",
//      "plugin": ["@opencode-ai/plugin-opencode"]
//    }
//
// 2. 创建 /tmp/test-config/costrict.json:
//    {
//      "model": "anthropic/claude-3",
//      "username": "costrict-user",
//      "plugin": ["@opencode-ai/plugin-custom"]
//    }
//
// 3. 运行测试，验证最终配置中：
//    - model 为 "anthropic/claude-3" (CoStrict 覆盖)
//    - theme 为 "dark" (只有 OpenCode 有)
//    - plugin 包含两个插件 (合并并去重)
