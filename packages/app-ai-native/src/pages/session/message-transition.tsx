import { createEffect, createMemo, createSignal, onCleanup, ParentProps, splitProps } from "solid-js"
import "./message-transition.css"

type MessageTransitionProps = {
  messageID?: string
  isUpdating?: boolean
  onTransitionEnd?: () => void
} & ParentProps

/**
 * MessageTransition Component
 *
 * Provides smooth transitions for message content updates to prevent flickering
 * when loadMessages replaces local data with server data.
 *
 * Usage:
 * ```tsx
 * <MessageTransition
 *   messageID={message.id}
 *   isUpdating={isMessageUpdating(message.id)}
 *   onTransitionEnd={() => handleUpdateComplete(message.id)}
 * >
 *   <MessageContent {...message} />
 * </MessageTransition>
 * ```
 */
export function MessageTransition(props: MessageTransitionProps) {
  const [local, rest] = splitProps(props, ["messageID", "isUpdating", "onTransitionEnd", "children"])

  const [transitionState, setTransitionState] = createSignal<"idle" | "entering" | "updating" | "exiting">("idle")
  const [contentHeight, setContentHeight] = createSignal<string | undefined>(undefined)

  let containerRef: HTMLDivElement | undefined
  let transitionTimer: ReturnType<typeof setTimeout> | undefined
  let heightObserver: ResizeObserver | undefined

  // Track content height to prevent layout shifts
  createEffect(() => {
    if (!containerRef) return

    const updateHeight = () => {
      const height = containerRef?.offsetHeight
      if (height && height > 0) {
        setContentHeight(`${height}px`)
      }
    }

    // Initial height capture
    updateHeight()

    // Observe height changes
    heightObserver = new ResizeObserver(() => {
      updateHeight()
    })
    heightObserver.observe(containerRef)

    onCleanup(() => {
      heightObserver?.disconnect()
    })
  })

  // Handle update state transitions
  createEffect(() => {
    const isUpdating = local.isUpdating
    const current = transitionState()

    if (isUpdating && current === "idle") {
      // Starting update process
      setTransitionState("updating")

      // Clear any existing timer
      if (transitionTimer) {
        clearTimeout(transitionTimer)
      }

      // Allow updating state to be visible briefly
      transitionTimer = setTimeout(() => {
        setTransitionState("idle")
        local.onTransitionEnd?.()
      }, 300) // Match CSS transition duration

    } else if (!isUpdating && current === "updating") {
      // Update completed
      setTransitionState("idle")
      local.onTransitionEnd?.()
    }
  })

  // Don't apply transitions if component is not updating
  const shouldShowTransition = createMemo(() => local.isUpdating || transitionState() !== "idle")

  onCleanup(() => {
    if (transitionTimer) {
      clearTimeout(transitionTimer)
    }
  })

  const getTransitionClass = () => {
    const state = transitionState()
    switch (state) {
      case "entering":
        return "message-entering"
      case "updating":
        return "message-updating"
      case "exiting":
        return "message-exiting"
      default:
        return ""
    }
  }

  return (
    <div
      ref={containerRef}
      class={shouldShowTransition() ? `message-content-transition ${getTransitionClass()}`.trim() : ""}
      style={{
        "--original-height": contentHeight() || "auto"
      } as any}
      data-transition-state={transitionState()}
      data-message-id={local.messageID}
      data-is-transitioning={shouldShowTransition()}
      {...rest}
    >
      <div class={shouldShowTransition() ? "message-preserve-space" : ""}>
        {local.children}
      </div>
    </div>
  )
}

/**
 * Hook to track message update state
 * Helps prevent flickering by tracking which messages are being updated
 */
export function createMessageUpdateTracker() {
  const [updatingMessages, setUpdatingMessages] = createSignal<Set<string>>(new Set())
  const [updatingParts, setUpdatingParts] = createSignal<Record<string, Set<string>>>({})

  const markMessageUpdating = (messageID: string, isUpdating: boolean) => {
    setUpdatingMessages((prev) => {
      const next = new Set(prev)
      if (isUpdating) {
        next.add(messageID)
      } else {
        next.delete(messageID)
      }
      return next
    })
  }

  const markPartUpdating = (messageID: string, partIndex: number, isUpdating: boolean) => {
    setUpdatingParts((prev) => {
      const next = { ...prev }
      if (!next[messageID]) {
        next[messageID] = new Set()
      }
      const partSet = new Set(next[messageID])
      if (isUpdating) {
        partSet.add(String(partIndex))
      } else {
        partSet.delete(String(partIndex))
      }
      next[messageID] = partSet
      return next
    })
  }

  const isMessageUpdating = (messageID: string) => {
    return updatingMessages().has(messageID)
  }

  const isPartUpdating = (messageID: string, partIndex: number) => {
    return updatingParts()[messageID]?.has(String(partIndex)) ?? false
  }

  const clearUpdatingState = () => {
    setUpdatingMessages(new Set<string>())
    setUpdatingParts({})
  }

  return {
    updatingMessages,
    updatingParts,
    markMessageUpdating,
    markPartUpdating,
    isMessageUpdating,
    isPartUpdating,
    clearUpdatingState
  }
}