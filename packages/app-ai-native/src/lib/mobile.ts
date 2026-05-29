import { createEffect, createSignal, onCleanup } from "solid-js"

const MOBILE_BREAKPOINT = 768

function getInitialMobile() {
  if (typeof window === "undefined") return false
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
}

const [isMobile, setIsMobile] = createSignal(getInitialMobile())

export { isMobile }

export function useSyncMobile() {
  createEffect(() => {
    if (typeof window === "undefined") return
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches)
    }
    mql.addEventListener("change", update)
    onCleanup(() => mql.removeEventListener("change", update))
  })
}
