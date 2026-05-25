import { apiFetch } from "@/pages/store/lib/api"

export interface AuthIdentity {
  provider: string
  displayName: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  lastLoginAt: string | null
}

export async function listIdentities(): Promise<AuthIdentity[]> {
  const res = await apiFetch<{ identities: AuthIdentity[] }>("/api/auth/identities")
  return res.identities ?? []
}

export async function startBind(provider: string, redirectTo?: string): Promise<string> {
  const prefix = (import.meta as any).env?.VITE_API_PREFIX ?? ""
  const basePath = (import.meta as any).env?.VITE_BASE_PATH ?? "/"

  const res = await apiFetch<{ authUrl: string }>("/api/auth/bind/start", {
    method: "POST",
    body: JSON.stringify({
      provider,
      redirectTo: redirectTo ?? new URL((basePath === "/" ? "" : basePath) + "/console/identity?bind=success", window.location.origin).href,
      callbackUrl: new URL((prefix || "/api") + "/auth/callback", window.location.origin).href,
    }),
  })
  return res.authUrl
}

export async function unbindIdentity(provider: string): Promise<{ requireRelogin: boolean }> {
  return apiFetch<{ requireRelogin: boolean }>(`/api/auth/identities/${provider}/unbind`, {
    method: "POST",
  })
}
