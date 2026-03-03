import { describe, expect, test } from "bun:test"
import { MessageV2 } from "../../src/session/message-v2"

describe("session.message-v2.ReasoningOnlyError", () => {
  test("should create ReasoningOnlyError", () => {
    const error = new MessageV2.ReasoningOnlyError({}).toObject()

    expect(error).toBeDefined()
    expect(error.name).toBe("MessageReasoningOnlyError")
    expect(error.data).toBeDefined()
  })

  test("should identify ReasoningOnlyError instance", () => {
    const error = new MessageV2.ReasoningOnlyError({}).toObject()

    expect(MessageV2.ReasoningOnlyError.isInstance(error)).toBe(true)
  })

  test("should not identify other errors as ReasoningOnlyError", () => {
    const apiError = new MessageV2.APIError({
      message: "Test error",
      isRetryable: false,
    }).toObject()

    expect(MessageV2.ReasoningOnlyError.isInstance(apiError)).toBe(false)
  })

  test("should be distinguishable from OutputLengthError", () => {
    const reasoningError = new MessageV2.ReasoningOnlyError({}).toObject()
    const lengthError = new MessageV2.OutputLengthError({}).toObject()

    expect(MessageV2.ReasoningOnlyError.isInstance(reasoningError)).toBe(true)
    expect(MessageV2.ReasoningOnlyError.isInstance(lengthError)).toBe(false)
    expect(MessageV2.OutputLengthError.isInstance(lengthError)).toBe(true)
    expect(MessageV2.OutputLengthError.isInstance(reasoningError)).toBe(false)
  })
})
