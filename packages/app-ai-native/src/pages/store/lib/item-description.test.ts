import { describe, test, expect } from "bun:test"
import { pickItemDescription } from "./item-description"

describe("pickItemDescription", () => {
  test("returns localized text when locale key exists", () => {
    const item = {
      description: "A skill that does X",
      descriptions: { en: "A skill that does X", zh: "一个执行 X 的技能" },
    }
    expect(pickItemDescription(item, "zh")).toBe("一个执行 X 的技能")
  })

  test("falls back to en when locale key missing", () => {
    const item = {
      description: "A skill",
      descriptions: { en: "A skill" },
    }
    expect(pickItemDescription(item, "zh")).toBe("A skill")
  })

  test("falls back to legacy description when descriptions map empty", () => {
    const item = { description: "Legacy text", descriptions: {} }
    expect(pickItemDescription(item, "zh")).toBe("Legacy text")
  })

  test("falls back to legacy description when descriptions undefined", () => {
    const item = { description: "Plain text" }
    expect(pickItemDescription(item, "zh")).toBe("Plain text")
  })

  test("returns empty string when nothing is set", () => {
    expect(pickItemDescription({}, "zh")).toBe("")
  })

  test("returns empty string for null/undefined item", () => {
    expect(pickItemDescription(null, "zh")).toBe("")
    expect(pickItemDescription(undefined, "zh")).toBe("")
  })

  test("en locale picks en directly", () => {
    const item = {
      description: "ignored",
      descriptions: { en: "A", zh: "一" },
    }
    expect(pickItemDescription(item, "en")).toBe("A")
  })
})
