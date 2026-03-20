export function getProxyUrl(deviceId: string) {
    const appUrl = import.meta.env.VITE_APP_URL
    return `${appUrl}/cloud/device/${deviceId}/proxy`
}