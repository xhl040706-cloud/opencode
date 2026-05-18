import { createEffect, createSignal } from "solid-js"
import { useLocation } from "@solidjs/router"

const [isMobile, setIsMobile] = createSignal(false)

export { isMobile }

export function useSyncMobileRoute() {
  const location = useLocation()
  createEffect(() => {
    const path = location.pathname
    setIsMobile(path.startsWith("/m/"))
  })
}
