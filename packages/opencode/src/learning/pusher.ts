import { Log } from "@/util/log"
import { LearningStorage } from "./storage"
import { SkillCandidate, CandidatePushStatus } from "./types"
import { Bus } from "@/bus"
import { LearningEvent } from "./events"
import { loadCoStrictCredentials } from "@/costrict/provider/credentials"
import { getCoStrictBaseURL } from "@/costrict/provider/auth"
import { isCoStrictTokenValid, refreshCoStrictToken, extractExpiryFromJWT } from "@/costrict/provider/token"
import { saveCoStrictCredentials } from "@/costrict/provider/credentials"
import { Installation } from "@/installation"
import { v7 as uuidv7 } from "uuid"

const log = Log.create({ service: "learning.pusher" })

/**
 * Server API response types
 */
interface PushSkillRequest {
  name: string
  slug: string
  description: string
  item_type: "skill"
  registry_id?: string
  content: string
  visibility: "private" | "team" | "public"
  metadata: {
    source: "client_generated"
    sourceIds: string[]
    confidence: number
    clientVersion: string
    generatedAt?: string
  }
}

interface PushSkillResponse {
  id: string
  name: string
  slug: string
  status: string
  url: string
  createdAt: string
}

/**
 * Skill pusher module
 * Handles pushing skill candidates to the CoStrict server
 */
export namespace SkillPusher {
  /**
   * Check if server is configured and credentials exist
   */
  export async function isServerConfigured(): Promise<boolean> {
    const credentials = await loadCoStrictCredentials()
    return credentials !== null && !!credentials.access_token
  }

  /**
   * Get the server URL for skill push
   */
  export async function getServerUrl(): Promise<string | null> {
    const credentials = await loadCoStrictCredentials()
    if (!credentials) return null
    return getCoStrictBaseURL(undefined, credentials.base_url)
  }

  /**
   * Create authenticated fetch with token refresh support
   */
  async function createAuthenticatedFetch(): Promise<{
    fetch: (url: string, init?: RequestInit) => Promise<Response>
    baseUrl: string
  }> {
    let creds = await loadCoStrictCredentials()

    if (!creds) {
      throw new Error("Not authenticated. Please run 'cs auth login' first.")
    }

    // Token validation and refresh
    if (creds.refresh_token && !isCoStrictTokenValid(creds)) {
      log.debug("Token expired, refreshing...")

      try {
        const refreshed = await refreshCoStrictToken({
          baseUrl: creds.base_url,
          refreshToken: creds.refresh_token,
          state: creds.state,
        })

        await saveCoStrictCredentials({
          ...creds,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expiry_date: extractExpiryFromJWT(refreshed.access_token),
          updated_at: new Date().toISOString(),
          expired_at: new Date(extractExpiryFromJWT(refreshed.access_token)).toISOString(),
        })

        creds.access_token = refreshed.access_token
      } catch (err) {
        log.error("Token refresh failed", { err })
        throw new Error("Authentication expired. Please run 'cs auth login' again.")
      }
    }

    const baseUrl = getCoStrictBaseURL(undefined, creds.base_url)

    const authFetch = async (url: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers)
      headers.set("Authorization", `Bearer ${creds!.access_token}`)
      headers.set("Content-Type", "application/json")
      headers.set("HTTP-Referer", "https://github.com/zgsm-ai/costrict-cli")
      headers.set("X-Title", "CoStrict-CLI")
      headers.set("X-Costrict-Version", `costrict-cli-${Installation.VERSION}`)
      headers.set("X-Request-ID", uuidv7())
      headers.set("zgsm-client-id", Installation.getInstallationId())
      headers.set("zgsm-client-ide", "cli")

      return fetch(url, { ...init, headers })
    }

    return { fetch: authFetch, baseUrl }
  }

  /**
   * Push a skill candidate to the server
   */
  export async function pushToServer(
    candidateId: string,
    options: {
      visibility?: "private" | "team" | "public"
      registryId?: string
    } = {},
  ): Promise<{
    success: boolean
    remoteId?: string
    remoteUrl?: string
    error?: string
  }> {
    try {
      // Load candidate
      const candidate = await LearningStorage.getCandidate(candidateId)
      if (!candidate) {
        return { success: false, error: `Candidate not found: ${candidateId}` }
      }

      // Check if already pushed
      if (candidate.pushStatus === "pushed" && candidate.remoteId) {
        return {
          success: true,
          remoteId: candidate.remoteId,
          remoteUrl: candidate.remoteUrl,
        }
      }

      // Get authenticated fetch
      const { fetch: authFetch, baseUrl } = await createAuthenticatedFetch()

      // Build request body
      const requestBody: PushSkillRequest = {
        name: candidate.name,
        slug: candidate.name,
        description: candidate.description,
        item_type: "skill",
        content: candidate.content,
        visibility: options.visibility || "private",
        registry_id: options.registryId,
        metadata: {
          source: "client_generated",
          sourceIds: candidate.sourceIds,
          confidence: candidate.confidence,
          clientVersion: Installation.VERSION,
          generatedAt: candidate.createdAt,
        },
      }

      // Push to server
      const response = await authFetch(`${baseUrl}/api/items`, {
        method: "POST",
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Server returned ${response.status}`

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorJson.error || errorMessage
        } catch {
          // Use default error message
        }

        // Update candidate status to push_failed
        await LearningStorage.updateCandidatePushStatus(candidateId, "push_failed")

        log.error("Failed to push skill", { status: response.status, error: errorMessage })
        return { success: false, error: errorMessage }
      }

      const result = (await response.json()) as PushSkillResponse

      // Update candidate with push info
      await LearningStorage.updateCandidatePushStatus(candidateId, "pushed", {
        pushedAt: new Date().toISOString(),
        remoteId: result.id,
        remoteUrl: result.url,
      })

      // Emit event
      Bus.publish(LearningEvent.CandidatePushed, {
        candidateId,
        remoteId: result.id,
        remoteUrl: result.url,
      })

      log.info("Skill pushed successfully", {
        candidateId,
        remoteId: result.id,
        remoteUrl: result.url,
      })

      return {
        success: true,
        remoteId: result.id,
        remoteUrl: result.url,
      }
    } catch (err: any) {
      log.error("Failed to push skill", { candidateId, err })

      // Try to update status to push_failed
      try {
        await LearningStorage.updateCandidatePushStatus(candidateId, "push_failed")
      } catch {
        // Ignore storage errors
      }

      return {
        success: false,
        error: err.message || "Unknown error",
      }
    }
  }

  /**
   * Update an existing skill on the server
   */
  export async function updateOnServer(
    candidateId: string,
    options: {
      visibility?: "private" | "team" | "public"
    } = {},
  ): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const candidate = await LearningStorage.getCandidate(candidateId)
      if (!candidate) {
        return { success: false, error: `Candidate not found: ${candidateId}` }
      }

      if (!candidate.remoteId) {
        return { success: false, error: "Skill has not been pushed to server yet" }
      }

      const { fetch: authFetch, baseUrl } = await createAuthenticatedFetch()

      const requestBody = {
        name: candidate.name,
        description: candidate.description,
        content: candidate.content,
        visibility: options.visibility || "private",
      }

      const response = await authFetch(`${baseUrl}/api/items/${candidate.remoteId}`, {
        method: "PUT",
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `Server returned ${response.status}`

        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.message || errorJson.error || errorMessage
        } catch {
          // Use default error message
        }

        return { success: false, error: errorMessage }
      }

      log.info("Skill updated successfully", { candidateId, remoteId: candidate.remoteId })

      return { success: true }
    } catch (err: any) {
      log.error("Failed to update skill", { candidateId, err })
      return { success: false, error: err.message || "Unknown error" }
    }
  }

  /**
   * Get push history for a candidate
   */
  export async function getPushHistory(candidateId: string): Promise<{
    success: boolean
    history?: Array<{
      pushedAt: string
      remoteId: string
      remoteUrl: string
    }>
    error?: string
  }> {
    try {
      const candidate = await LearningStorage.getCandidate(candidateId)
      if (!candidate) {
        return { success: false, error: `Candidate not found: ${candidateId}` }
      }

      if (candidate.pushStatus !== "pushed" || !candidate.remoteId) {
        return { success: true, history: [] }
      }

      return {
        success: true,
        history: [
          {
            pushedAt: candidate.pushedAt || "",
            remoteId: candidate.remoteId,
            remoteUrl: candidate.remoteUrl || "",
          },
        ],
      }
    } catch (err: any) {
      log.error("Failed to get push history", { candidateId, err })
      return { success: false, error: err.message || "Unknown error" }
    }
  }
}
