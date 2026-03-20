import { createContext, useContext, type ParentProps } from "solid-js"
const PREFIX = import.meta.env.VITE_API_PREFIX ?? ""
import { createStore } from "solid-js/store"
import { onMount } from "solid-js"
import type { CasdoorUser } from "@/pages/store/lib/auth"

interface AuthState {
  user: CasdoorUser | null
  loading: boolean
}

interface AuthContextValue {
  user: () => CasdoorUser | null
  loading: () => boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: () => null,
  loading: () => true,
  logout: async () => {},
})

export function AuthProvider(props: ParentProps) {
  const [state, setState] = createStore<AuthState>({ user: null, loading: true })

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get("code")
    if (!code) return false

    const appUrl = import.meta.env.VITE_APP_URL
    const qs = new URLSearchParams({ code, redirect_uri: `${appUrl}/store` })

    try {
      const res = await fetch(`${PREFIX}/api/auth/callback?${qs.toString()}`, { credentials: "include" })
      if (!res.ok) return false

      const redirectTo = decodeURIComponent(params.get("state") ?? "/store")
      window.history.replaceState({}, "", window.location.pathname)
      if (redirectTo !== window.location.pathname) window.location.href = redirectTo
      return true
    } catch {
      return false
    }
  }

  async function fetchUser() {
    try {
      const res = await fetch(`${PREFIX}/api/auth/me`, { credentials: "include" })
      setState("user", res.ok ? ((await res.json()).user ?? null) : null)
    } catch {
      setState("user", null)
    }
  }

  onMount(async () => {
    await handleCallback()
    await fetchUser()
    setState("loading", false)
  })

  const logout = async () => {
    await fetch(`${PREFIX}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {})
    setState("user", null)
    window.location.href = "/"
  }

  return (
    <AuthContext.Provider value={{ user: () => state.user, loading: () => state.loading, logout }}>
      {props.children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
