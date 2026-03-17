export interface CasdoorUser {
  sub: string
  name?: string
  preferred_username?: string
  email?: string
  picture?: string
  owner?: string
}

export function getLoginUrl(redirectTo?: string) {
  const endpoint = import.meta.env.VITE_CASDOOR_ENDPOINT
  const clientId = import.meta.env.VITE_CASDOOR_CLIENT_ID
  const appUrl = import.meta.env.VITE_APP_URL
  const appName = import.meta.env.VITE_CASDOOR_APP_NAME

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: appUrl,
    scope: "openid profile email",
    response_type: "code",
    state: encodeURIComponent(redirectTo || "/"),
  })

  return `${endpoint}/login/oauth/authorize?${params.toString()}&applicationName=${appName}`
}
