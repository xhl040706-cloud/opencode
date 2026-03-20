import { env } from "@/lib/env"

export interface CasdoorUser {
  sub: string
  name?: string
  preferred_username?: string
  email?: string
  picture?: string
  owner?: string
}

export function getLoginUrl(redirectTo?: string) {
  const endpoint = env.CASDOOR_ENDPOINT
  const clientId = env.CASDOOR_CLIENT_ID ?? ""
  const appUrl = env.APP_URL ?? ""
  const appName = env.CASDOOR_APP_NAME ?? ""

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: appUrl,
    scope: "openid profile email",
    response_type: "code",
    state: encodeURIComponent(redirectTo || "/"),
  })

  return `${endpoint}/login/oauth/authorize?${params.toString()}&applicationName=${appName}`
}
