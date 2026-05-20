import { describe, expect, test } from "bun:test"
import { invalidateFromHostWatcher } from "./watcher"

describe("cs-cloud host file watcher invalidation", () => {
  test("handles host.file.created events", () => {
    const loads: string[] = []
    const refresh: string[] = []

    invalidateFromHostWatcher(
      {
        type: "host.file.created",
        properties: {
          file: "src/new.ts",
          timestamp: 1234567890,
        },
      },
      {
        normalize: (input) => input,
        hasFile: (path) => path === "src/new.ts",
        loadFile: (path) => loads.push(path),
        node: () => undefined,
        isDirLoaded: (path) => path === "src",
        refreshDir: (path) => refresh.push(path),
      },
    )

    expect(loads).toEqual(["src/new.ts"])
    expect(refresh).toEqual(["src"])
  })

  test("handles host.file.updated events", () => {
    const loads: string[] = []
    const refresh: string[] = []

    invalidateFromHostWatcher(
      {
        type: "host.file.updated",
        properties: {
          file: "src/updated.ts",
          timestamp: 1234567890,
        },
      },
      {
        normalize: (input) => input,
        hasFile: (path) => path === "src/updated.ts",
        loadFile: (path) => loads.push(path),
        node: () => undefined,
        isDirLoaded: (path) => path === "src",
        refreshDir: (path) => refresh.push(path),
      },
    )

    expect(loads).toEqual(["src/updated.ts"])
    expect(refresh).toEqual(["src"])
  })

  test("handles host.file.deleted events", () => {
    const refresh: string[] = []

    invalidateFromHostWatcher(
      {
        type: "host.file.deleted",
        properties: {
          file: "src/deleted.ts",
          timestamp: 1234567890,
        },
      },
      {
        normalize: (input) => input,
        hasFile: () => false,
        loadFile: () => {},
        node: () => undefined,
        isDirLoaded: (path) => path === "src",
        refreshDir: (path) => refresh.push(path),
      },
    )

    expect(refresh).toEqual(["src"])
  })

  test("handles host.file.renamed events", () => {
    const refresh: string[] = []

    invalidateFromHostWatcher(
      {
        type: "host.file.renamed",
        properties: {
          file: "src/old.ts",
          timestamp: 1234567890,
        },
      },
      {
        normalize: (input) => input,
        hasFile: () => false,
        loadFile: () => {},
        node: () => undefined,
        isDirLoaded: (path) => path === "src",
        refreshDir: (path) => refresh.push(path),
      },
    )

    expect(refresh).toEqual(["src"])
  })

  test("ignores git files in host events", () => {
    const loads: string[] = []
    const refresh: string[] = []

    invalidateFromHostWatcher(
      {
        type: "host.file.updated",
        properties: {
          file: ".git/index",
          timestamp: 1234567890,
        },
      },
      {
        normalize: (input) => input,
        hasFile: () => true,
        loadFile: (path) => loads.push(path),
        node: () => undefined,
        isDirLoaded: () => true,
        refreshDir: (path) => refresh.push(path),
      },
    )

    expect(loads).toEqual([])
    expect(refresh).toEqual([])
  })

  test("ignores non-host events", () => {
    const loads: string[] = []
    const refresh: string[] = []

    invalidateFromHostWatcher(
      {
        type: "file.watcher.updated",
        properties: {
          file: "test.ts",
          event: "change",
        },
      },
      {
        normalize: (input) => input,
        hasFile: () => true,
        loadFile: (path) => loads.push(path),
        node: () => undefined,
        isDirLoaded: () => true,
        refreshDir: (path) => refresh.push(path),
      },
    )

    expect(loads).toEqual([])
    expect(refresh).toEqual([])
  })
})
