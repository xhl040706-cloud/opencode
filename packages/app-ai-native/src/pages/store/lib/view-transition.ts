// View Transitions helpers for the store list (card ⇄ list switch + filter changes).
//
// SolidJS renders synchronously with no async queue, so calling `setSignal(...)` inside the
// `startViewTransition` callback mutates the DOM within the capture window — no `flushSync`
// equivalent is needed. When the browser lacks the API (Safari < 18 / older Firefox), we just
// run the update directly (progressive enhancement).

const STAGGER_STYLE_ID = "store-vt-stagger"
const STAGGER_STEP_MS = 22

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => unknown
}

/**
 * Run `update` inside a view transition when supported, otherwise run it directly.
 * `update` should perform the synchronous Solid signal writes that mutate the DOM.
 */
export function withViewTransition(update: () => void): void {
  if (typeof document === "undefined") {
    update()
    return
  }
  const doc = document as DocumentWithViewTransition
  if (typeof doc.startViewTransition !== "function") {
    update()
    return
  }
  doc.startViewTransition(() => update())
}

/**
 * Inject per-item `::view-transition-group` `animation-delay` rules so visible items animate in a
 * staggered sequence (i * 22ms by document order). Each id gets its item / media / name groups
 * delayed together. Passing an empty array clears the injected `<style>`.
 */
export function applyStagger(ids: string[]): void {
  if (typeof document === "undefined") return

  let style = document.getElementById(STAGGER_STYLE_ID) as HTMLStyleElement | null
  if (ids.length === 0) {
    if (style) style.textContent = ""
    return
  }

  if (!style) {
    style = document.createElement("style")
    style.id = STAGGER_STYLE_ID
    document.head.appendChild(style)
  }

  style.textContent = ids
    .map((id, index) => {
      const delay = index * STAGGER_STEP_MS
      return [
        `::view-transition-group(vt-item-${id})`,
        `::view-transition-group(vt-media-${id})`,
        `::view-transition-group(vt-name-${id})`,
      ].join(",") + `{animation-delay:${delay}ms}`
    })
    .join("")
}
