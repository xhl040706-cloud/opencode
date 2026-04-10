import type { Project } from "@opencode-ai/sdk/v2/client"
import type { ProviderCapabilitiesResponse } from "./types"

export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function normalizeProviderList(input: ProviderCapabilitiesResponse): ProviderCapabilitiesResponse {
  return {
    ...input,
    connected: input.connected.map((provider) => ({
      ...provider,
      models: Object.fromEntries(Object.entries(provider.models).filter(([, info]) => info.status !== "deprecated")),
    })),
  }
}

export function sanitizeProject(project: Project) {
  if (!project.icon?.url && !project.icon?.override) return project
  return {
    ...project,
    icon: {
      ...project.icon,
      url: undefined,
      override: undefined,
    },
  }
}
