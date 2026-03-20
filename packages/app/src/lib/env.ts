/**
 * Runtime environment variables utility
 *
 * This module provides a unified way to access environment variables that can be
 * injected at runtime (via Docker) or fallback to build-time values (import.meta.env).
 *
 * In production Docker deployments, the docker-entrypoint.sh script replaces
 * placeholders in index.html with actual environment variable values.
 */

// Declare the runtime env type
declare global {
  interface Window {
    __ENV__?: Record<string, string | undefined>
  }
}

/**
 * Get an environment variable value.
 * Priority: runtime (window.__ENV__) > build-time (import.meta.env)
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  // Check runtime environment first (for Docker deployments)
  if (typeof window !== "undefined" && window.__ENV__) {
    const runtimeValue = window.__ENV__[key]
    if (runtimeValue !== undefined && runtimeValue !== "") {
      return runtimeValue
    }
  }

  // Fallback to build-time environment variables
  const buildTimeValue = (import.meta.env as Record<string, string | undefined>)[key]
  if (buildTimeValue !== undefined && buildTimeValue !== "") {
    return buildTimeValue
  }

  return defaultValue
}

/**
 * Environment variables with defaults
 */
export const env = {
  // Server configuration
  get CLOUD_SERVER_HOST() {
    return getEnv("VITE_CLOUD_SERVER_HOST", "localhost")
  },
  get CLOUD_SERVER_PORT() {
    return getEnv("VITE_CLOUD_SERVER_PORT", "18080")
  },
  get APP_PORT() {
    return getEnv("VITE_APP_PORT", "3000")
  },
  get API_PREFIX() {
    return getEnv("VITE_API_PREFIX", "")
  },
  get APP_URL() {
    return getEnv("VITE_APP_URL", "http://localhost:3000")
  },
  get API_URL() {
    return getEnv("VITE_API_URL", "")
  },

  // Casdoor authentication
  get CASDOOR_ENDPOINT() {
    return getEnv("VITE_CASDOOR_ENDPOINT", "http://localhost:18000")
  },
  get CASDOOR_CLIENT_ID() {
    return getEnv("VITE_CASDOOR_CLIENT_ID", "")
  },
  get CASDOOR_APP_NAME() {
    return getEnv("VITE_CASDOOR_APP_NAME", "app-built-in")
  },
  get CASDOOR_ORG_NAME() {
    return getEnv("VITE_CASDOOR_ORG_NAME", "built-in")
  },

  // Store
  get STORE_URL() {
    return getEnv("VITE_STORE_URL", "")
  },

  // OpenCode cloud device
  get OPENCODE_CLOUD_DEVICE_ID() {
    return getEnv("VITE_OPENCODE_CLOUD_DEVICE_ID", "")
  },
  get OPENCODE_SERVER_HOST() {
    return getEnv("VITE_OPENCODE_SERVER_HOST", "localhost")
  },
  get OPENCODE_SERVER_PORT() {
    return getEnv("VITE_OPENCODE_SERVER_PORT", "8080")
  },
}
