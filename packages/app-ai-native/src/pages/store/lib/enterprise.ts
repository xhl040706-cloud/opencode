// Enterprise ("大客户") branding for store items.
//
// TODO(backend): replace the hard-coded ENTERPRISE_BY_CREATED_BY map below with a
// `GET /api/enterprise-customers` fetch (returns `{ createdBy, name, logo }[]`, logo as a
// same-origin URL or data URI). The public API (`matchEnterprise`) stays the same — only the
// data source changes — so call sites won't need to be touched when the backend lands.
//
// Until then we map a few demo items to enterprises purely on the frontend so the branded
// card/row treatment is visible in demo mode (and against real data where `createdBy` matches).

import { CMB_LOGO, ICBC_LOGO } from "./enterprise-logos"

export interface EnterpriseInfo {
  /** Display name shown beside the logo (e.g. 招商银行). */
  name: string
  /** Logo as a base64 data URI to avoid cross-origin canvas tainting when extracting colors. */
  logo: string
}

/**
 * Hard-coded enterprise mapping keyed by the uploader account id (`CapabilityItem.createdBy`).
 *
 * In real data `createdBy` is the stable enterprise account id; in demo mode the mock items are
 * authored by shared placeholder users (e.g. `user-002`), so the primary demo path uses the
 * name-based fallback (`ENTERPRISE_BY_NAME`) instead — see `matchEnterprise` / `matchEnterpriseByName`.
 */
const ENTERPRISE_BY_CREATED_BY: Record<string, EnterpriseInfo> = {
  // Wire real enterprise account ids here once known, e.g.:
  // "cmb-enterprise-account-id": { name: "招商银行", logo: CMB_LOGO },
}

/**
 * Demo fallback: bind specific mock items to enterprises by their (stable) item name so the
 * branded treatment is guaranteed to appear in demo mode where `createdBy` is not enterprise-unique.
 */
const ENTERPRISE_BY_NAME: Record<string, EnterpriseInfo> = {
  // item-skill-1 (Code Reviewer) → 招商银行
  "Code Reviewer": { name: "招商银行", logo: CMB_LOGO },
  // item-plugin-3 (Security Scanner) → 工商银行
  "Security Scanner": { name: "工商银行", logo: ICBC_LOGO },
}

/**
 * Resolve enterprise branding for an item from its uploader account id (`createdBy`).
 * Returns `null` when the uploader is not a configured enterprise.
 */
export function matchEnterprise(createdBy: string | undefined): EnterpriseInfo | null {
  if (!createdBy) return null
  return ENTERPRISE_BY_CREATED_BY[createdBy] ?? null
}

/**
 * Demo-only fallback used when `createdBy` is not enterprise-unique (mock data): resolve by the
 * item's display name. Real backend wiring should rely on `matchEnterprise(createdBy)` instead.
 */
export function matchEnterpriseByName(name: string | undefined): EnterpriseInfo | null {
  if (!name) return null
  return ENTERPRISE_BY_NAME[name] ?? null
}
