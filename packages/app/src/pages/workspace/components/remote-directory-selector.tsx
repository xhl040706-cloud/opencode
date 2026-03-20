import { FileIcon } from "@opencode-ai/ui/file-icon"
import { List } from "@opencode-ai/ui/list"
import type { ListRef } from "@opencode-ai/ui/list"
import { Button } from "@opencode-ai/ui/button"
import fuzzysort from "fuzzysort"
import { createSignal, createMemo, Show, batch, onCleanup } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { getDirectory, getFilename } from "@opencode-ai/util/path"
import { cloudDeviceFileApi, type FileNode, checkCloudFileSupport } from "../lib/cloud-device-api"
import type { Device } from "../types"

export interface RemoteDirectorySelectorProps {
  device: Device
  onSelect: (directory: string | null) => void
  onCancel?: () => void
}

type Row = {
  absolute: string
  search: string
  name: string
  parent: string
}

function normalizePath(input: string) {
  const v = input.replaceAll("\\", "/")
  if (v.startsWith("//") && !v.startsWith("///")) return "//" + v.slice(2).replace(/\/+/g, "/")
  return v.replace(/\/+/g, "/")
}

function trimTrailing(input: string) {
  if (input === "/") return input
  if (input.endsWith("/")) return input.slice(0, -1)
  return input
}

function getParentPath(path: string): string | null {
  const trimmed = trimTrailing(path)
  if (trimmed === "/") return null
  const lastSlash = trimmed.lastIndexOf("/")
  if (lastSlash <= 0) return "/"
  return trimmed.slice(0, lastSlash) || "/"
}

function displayPath(absolute: string) {
  const trimmed = trimTrailing(absolute)
  const parent = getDirectory(trimmed)
  const name = getFilename(trimmed)
  return { parent: parent || "/", name: name || trimmed }
}

function isAbsolutePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/")
  if (normalized.startsWith("/")) return true
  if (/^[A-Za-z]:[/\\]?.*/.test(normalized)) return true
  return false
}

function normalizeWindowsPath(input: string): string {
  const normalized = input.replace(/\\/g, "/")
  if (/^[A-Za-z]:$/.test(normalized)) {
    return normalized + "/"
  }
  return normalized
}

function useDirectoryCache(deviceId: () => string) {
  const cache = new Map<string, Promise<FileNode[]>>()
  const pending = new Map<string, AbortController>()

  const fetch = async (path: string): Promise<FileNode[]> => {
    const key = normalizePath(trimTrailing(path))
    const existing = cache.get(key)
    if (existing) return existing

    const controller = new AbortController()
    pending.set(key, controller)

    const request = cloudDeviceFileApi.list(deviceId(), path)
      .then((result) => {
        pending.delete(key)
        return result || []
      })
      .catch((err) => {
        pending.delete(key)
        cache.delete(key)
        throw err
      })

    cache.set(key, request)
    return request
  }

  const get = (path: string): FileNode[] | undefined => {
    const key = normalizePath(trimTrailing(path))
    const promise = cache.get(key)
    if (!promise) return undefined
    return undefined
  }

  const clear = () => {
    cache.clear()
    pending.forEach((controller) => controller.abort())
    pending.clear()
  }

  onCleanup(clear)

  return { fetch, get, clear, cache }
}

export function RemoteDirectorySelector(props: RemoteDirectorySelectorProps) {
  const [currentPath, setCurrentPath] = createSignal("/")
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null)
  const [notSupported, setNotSupported] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [directories, setDirectories] = createSignal<FileNode[]>([])
  let list: ListRef | undefined

  const dirCache = useDirectoryCache(() => props.device.deviceId)

  const loadPath = async (path: string) => {
    if (notSupported()) return
    setLoading(true)
    try {
      const result = await dirCache.fetch(path)
      const dirs = result.filter((item) => item.type === "directory")
      setDirectories(dirs)
    } catch (err) {
      console.error("Failed to load directory:", err)
    } finally {
      setLoading(false)
    }
  }

  const checkSupport = async () => {
    const result = await checkCloudFileSupport(props.device.deviceId)
    if (!result.supported) {
      setNotSupported(result.error || "设备不支持云端文件访问")
    } else {
      loadPath(currentPath())
    }
  }

  checkSupport()

  const items = async (query: string): Promise<Row[]> => {
    const dirs = directories()
    const normalizedQuery = normalizeWindowsPath(query).trim()

    const searchData = dirs.map((d) => {
      const display = displayPath(d.absolute)
      const searchFields = [
        d.name,
        d.absolute,
        d.absolute.replace(/\\/g, "/"),
      ].join(" ")

      return {
        ...d,
        display,
        searchFields,
      }
    })

    if (!normalizedQuery) {
      return searchData.map((d) => ({
        absolute: normalizePath(d.absolute),
        search: d.searchFields,
        name: d.display.name,
        parent: d.display.parent,
      }))
    }

    const filtered = fuzzysort.go(normalizedQuery, searchData, {
      key: "searchFields",
      limit: 50
    })

    return filtered.map((x) => ({
      absolute: normalizePath(x.obj.absolute),
      search: x.obj.searchFields,
      name: x.obj.display.name,
      parent: x.obj.display.parent,
    }))
  }

  const navigateTo = (path: string) => {
    batch(() => {
      setCurrentPath(path)
      setSelectedPath(path)
      list?.setFilter("")
    })
    loadPath(path)
  }

  const navigateUp = () => {
    const parent = getParentPath(currentPath())
    if (parent) {
      navigateTo(parent)
    }
  }

  const currentPathDisplay = createMemo(() => {
    const path = currentPath()
    if (path === "/") return "/"
    return trimTrailing(path)
  })

  const highlightedPath = createMemo(() => {
    return selectedPath() || currentPath()
  })

  function resolve(absolute: string) {
    props.onSelect(absolute)
    if (props.onCancel) {
      props.onCancel()
    }
  }

  const handleFilterChange = (value: string) => {
    const normalizedValue = normalizeWindowsPath(value).trim()
    if (normalizedValue && isAbsolutePath(normalizedValue)) {
      navigateTo(normalizeWindowsPath(normalizedValue))
    }
  }

  return (
    <div class="flex flex-col" style={{ height: "400px", "max-height": "80vh" }}>
      {/* 路径导航栏 */}
      <div class="flex items-center gap-2 px-4 py-2 border-b border-border-weak-base bg-surface-base shrink-0">
        <button
          type="button"
          class="p-1.5 rounded-md hover:bg-surface-base-hover disabled:opacity-50 transition-colors"
          onClick={navigateUp}
          disabled={currentPath() === "/" || !!notSupported()}
        >
          <Icon name="arrow-up" class="size-4" />
        </button>
        <div class="flex items-center gap-1 text-13-regular text-text-weak flex-1 min-w-0">
          <Icon name="folder" class="size-4 shrink-0" />
          <span class="truncate">{currentPathDisplay()}</span>
        </div>
        <span class="text-12-regular text-text-weaker">
          {directories().length} 个目录
        </span>
      </div>

      {/* 不支持提示 */}
      <Show when={notSupported()}>
        <div class="flex flex-col items-center justify-center p-6 text-text-weak shrink-0">
          <Icon name="warning" class="size-10 mb-3 text-yellow-500" />
          <p class="text-14-medium text-center">{notSupported()}</p>
          <p class="text-12-regular text-text-weaker mt-2 text-center">
            请在设备上创建 cloud.json 配置文件并设置 &quot;allowAbsolutePaths&quot;: true
          </p>
        </div>
      </Show>

      {/* 目录列表 */}
      <div class="flex-1 min-h-0 overflow-hidden" style={{ "max-height": "240px" }}>
        <List
          search={{
            placeholder: notSupported() ? "设备不支持云端访问" : "搜索目录或输入绝对路径如 D:/...",
            autofocus: true
          }}
          emptyMessage={loading() ? "加载中..." : notSupported() ? "设备不支持云端文件访问" : "暂无目录"}
          loadingMessage="加载中..."
          items={items}
          key={(x: Row) => x.absolute}
          filterKeys={["search"]}
          ref={(r: ListRef) => (list = r)}
          onFilter={handleFilterChange}
          onKeyEvent={(e, item) => {
            if (e.key !== "Tab") return
            if (e.shiftKey) return
            if (!item) return

            e.preventDefault()
            e.stopPropagation()

            const value = item.absolute
            list?.setFilter(value.endsWith("/") ? value : value + "/")
          }}
          onSelect={(path) => {
            if (!path) return
            setSelectedPath(path.absolute)
          }}
          class="h-full overflow-y-auto"
        >
          {(item: Row) => {
            const path = displayPath(item.absolute)
            const isSelected = highlightedPath() === item.absolute
            return (
              <div
                class={`w-full flex items-center justify-between rounded-md cursor-pointer ${isSelected ? "bg-surface-base-active" : ""}`}
                onDblClick={() => {
                  navigateTo(item.absolute)
                }}
              >
                <div class="flex items-center gap-x-3 grow min-w-0">
                  <FileIcon node={{ path: item.absolute, type: "directory" }} class="shrink-0 size-4" />
                  <div class="flex items-center text-14-regular min-w-0">
                    <span class="text-text-weak whitespace-nowrap overflow-hidden overflow-ellipsis truncate min-w-0">
                      {path.parent}
                    </span>
                    <span class="text-text-strong whitespace-nowrap">{path.name}</span>
                    <span class="text-text-weak whitespace-nowrap">/</span>
                  </div>
                </div>
              </div>
            )
          }}
        </List>
      </div>

      {/* 已选择路径预览 */}
      <div class="px-4 py-2 border-t border-border-weak-base bg-surface-base shrink-0">
        <div class="flex items-center gap-2">
          <span class="text-12-regular text-text-weak shrink-0">已选择:</span>
          <div class="flex-1 min-w-0 flex items-center gap-1 text-13-regular bg-surface-base-active px-2 py-1 rounded-md">
            <Icon name="folder" class="size-4 text-text-strong" />
            <span class="text-text-strong truncate">{highlightedPath()}</span>
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div class="flex items-center justify-end gap-2 px-4 py-2 border-t border-border-weak-base shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="normal"
          onClick={() => {
            props.onSelect(null)
            if (props.onCancel) {
              props.onCancel()
            }
          }}
        >
          取消
        </Button>
        <Button
          type="button"
          variant="primary"
          size="normal"
          onClick={() => resolve(highlightedPath())}
          disabled={!!notSupported()}
        >
          选择此目录
        </Button>
      </div>
    </div>
  )
}
