import { describe, expect, test } from "bun:test"
import { detectMcpFields, isPlaceholder, isSecret, type McpFieldLabels } from "./mcp-config"

// Fixed labels so the detector is testable without an i18n context.
const LABELS: McpFieldLabels = { path: "path", arg: (n) => `arg ${n}` }

describe("isPlaceholder", () => {
  test("treats unfilled shapes as placeholders", () => {
    expect(isPlaceholder("")).toBe(true)
    expect(isPlaceholder("   ")).toBe(true)
    expect(isPlaceholder("<token>")).toBe(true)
    expect(isPlaceholder("<your-api-key>")).toBe(true)
    expect(isPlaceholder("${VAR}")).toBe(true)
    expect(isPlaceholder("{{VAR}}")).toBe(true)
    expect(isPlaceholder("/path/to/your/server.py")).toBe(true)
    expect(isPlaceholder("YOUR_META_ACCESS_TOKEN")).toBe(true)
    expect(isPlaceholder("your_api_key")).toBe(true)
    expect(isPlaceholder("META_ACCESS_TOKEN")).toBe(true) // ALL_CAPS_SNAKE
    expect(isPlaceholder("change-me")).toBe(true)
    expect(isPlaceholder("replace_me")).toBe(true)
    expect(isPlaceholder("placeholder")).toBe(true)
    expect(isPlaceholder("xxxx")).toBe(true)
  })

  test("treats real values as NOT placeholders", () => {
    expect(isPlaceholder("python")).toBe(false)
    expect(isPlaceholder("/usr/bin/node")).toBe(false)
    expect(isPlaceholder("npx")).toBe(false)
    expect(isPlaceholder("-y")).toBe(false)
    expect(isPlaceholder("8080")).toBe(false)
    expect(isPlaceholder("exa-mcp-server")).toBe(false)
    expect(isPlaceholder("https://gitlab.com/api/v4")).toBe(false)
    expect(isPlaceholder("INFO")).toBe(false) // single ALL-CAPS segment, no underscore
    expect(isPlaceholder("info")).toBe(false)
  })

  test("ALL_CAPS_SNAKE (>=2 segments) values look like placeholder var names", () => {
    // A bare value that reads like an env-var name is treated as unfilled.
    expect(isPlaceholder("API_KEY")).toBe(true)
    expect(isPlaceholder("LOG_LEVEL")).toBe(true)
  })

  test("ignores non-strings", () => {
    expect(isPlaceholder(undefined)).toBe(false)
    expect(isPlaceholder(42)).toBe(false)
    expect(isPlaceholder(null)).toBe(false)
  })
})

describe("isSecret", () => {
  test("flags secret-ish labels/values", () => {
    expect(isSecret("fb-token", "YOUR_META_ACCESS_TOKEN")).toBe(true)
    expect(isSecret("API_KEY", "your_api_key")).toBe(true)
    expect(isSecret("password", "x")).toBe(true)
    expect(isSecret("OBSIDIAN_API_KEY", "<your_api_key_here>")).toBe(true)
  })

  test("does not flag pure paths or plain params", () => {
    expect(isSecret("path", "/Users/me/s.py")).toBe(false)
    expect(isSecret("port", "8080")).toBe(false)
    expect(isSecret("arg 1", "/path/to/your/server.py")).toBe(false)
  })
})

describe("detectMcpFields", () => {
  test("Facebook Ads (args-only): path arg + flagged token arg, flag itself skipped", () => {
    const metadata = {
      command: "python",
      args: ["/path/to/your/fb-ads-mcp-server/server.py", "--fb-token", "YOUR_META_ACCESS_TOKEN"],
    }
    const fields = detectMcpFields(metadata, LABELS)
    expect(fields).toHaveLength(2)

    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]))
    expect(Object.keys(byKey).sort()).toEqual(["args:0", "args:2"])

    // args:0 — bare path-like positional arg
    expect(byKey["args:0"].label).toBe("path")
    expect(byKey["args:0"].placeholder).toBe("/path/to/your/fb-ads-mcp-server/server.py")
    expect(byKey["args:0"].secret).toBe(false)
    expect(byKey["args:0"].required).toBe(true)

    // args:1 (the "--fb-token" flag) is a real value → NOT a field
    expect(byKey["args:1"]).toBeUndefined()

    // args:2 — value following the flag → label from flag, secret
    expect(byKey["args:2"].label).toBe("fb-token")
    expect(byKey["args:2"].placeholder).toBe("YOUR_META_ACCESS_TOKEN")
    expect(byKey["args:2"].secret).toBe(true)
  })

  test("env-only base case: env key NAME is the label, secret", () => {
    const fields = detectMcpFields({ command: "npx", args: ["-y", "exa-mcp-server"], env: { API_KEY: "YOUR_API_KEY" } }, LABELS)
    expect(fields).toHaveLength(1)
    expect(fields[0]).toMatchObject({
      key: "env:API_KEY",
      label: "API_KEY",
      placeholder: "YOUR_API_KEY",
      required: true,
      secret: true,
    })
  })

  test("mixed env: only placeholder values become fields, real defaults skipped", () => {
    const fields = detectMcpFields(
      {
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-gitlab"],
        env: { GITLAB_PERSONAL_ACCESS_TOKEN: "<YOUR_TOKEN>", GITLAB_API_URL: "https://gitlab.com/api/v4" },
      },
      LABELS,
    )
    expect(fields).toHaveLength(1)
    expect(fields[0].key).toBe("env:GITLAB_PERSONAL_ACCESS_TOKEN")
    expect(fields[0].secret).toBe(true)
  })

  test("no placeholders → no fields (subscribe stays ungated)", () => {
    const fields = detectMcpFields({ command: "python", args: ["/usr/bin/server.py", "--port", "8080"] }, LABELS)
    expect(fields).toEqual([])
  })

  test("empty / non-object metadata → no fields", () => {
    expect(detectMcpFields(null, LABELS)).toEqual([])
    expect(detectMcpFields(undefined, LABELS)).toEqual([])
    expect(detectMcpFields({}, LABELS)).toEqual([])
  })

  test("anonymous positional placeholder (no flag, not path-like) → generic arg label", () => {
    const fields = detectMcpFields({ command: "run", args: ["YOUR_VALUE"] }, LABELS)
    expect(fields).toHaveLength(1)
    expect(fields[0].key).toBe("args:0")
    expect(fields[0].label).toBe("arg 1")
  })
})
