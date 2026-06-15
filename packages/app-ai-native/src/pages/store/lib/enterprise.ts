// Enterprise ("大客户") branding for store items.
//
// TODO(backend): replace the hard-coded ENTERPRISE_CUSTOMERS list below with a
// `GET /api/enterprise-customers` fetch (returns `{ ids, name, logo }[]`, logo as a same-origin
// URL or data URI). The public API (`matchEnterprise` / `matchEnterpriseByName`) stays the same —
// only the data source backing ENTERPRISE_CUSTOMERS changes — so call sites won't need to be
// touched when the backend lands.
//
// HOW TO ADD A 大客户:
//   1. Add (or reuse) a brand logo data URI in `./enterprise-logos.ts` (see notes there — the
//      DOMINANT color of the artwork becomes the card background `--bc`).
//   2. Append one `EnterpriseConfig` entry to `ENTERPRISE_CUSTOMERS` below:
//        - `name`        display name beside the logo (可配)
//        - `logo`        logo data URI (可配)
//        - `ids`         REAL backend path: the enterprise's stable uploader account 唯一 ID(s).
//                        After a 大客户 registers, fill the unique ID it receives into this array.
//                        ONE 大客户 may own MULTIPLE accounts → list every account ID here; an item
//                        whose `CapabilityItem.createdBy` equals ANY of them is branded.
//        - `matchNames`  DEMO fallback: bind by the item's display name(s) (mock data authors items
//                        with shared placeholder users, so `createdBy` is not enterprise-unique).
//      Provide `ids` for real data and/or `matchNames` for demo — both may be set.

import { CMB_LOGO, ICBC_LOGO, CCB_LOGO } from "./enterprise-logos"

export interface EnterpriseInfo {
  /** Display name shown beside the logo (e.g. 招商银行). */
  name: string
  /** Logo as a base64 data URI to avoid cross-origin canvas tainting when extracting colors. */
  logo: string
}

/** One configurable enterprise customer. Add/remove entries in `ENTERPRISE_CUSTOMERS`. */
export interface EnterpriseConfig extends EnterpriseInfo {
  /**
   * Real backend key: the enterprise's stable uploader account 唯一 ID(s). An item is branded when
   * `CapabilityItem.createdBy` matches ANY id here — a single 大客户 may register multiple accounts,
   * so list each account's unique ID. Optional in demo mode (use `matchNames` instead).
   */
  ids?: string[]
  /**
   * Demo fallback key: bind by the item's (stable) display name(s), since mock data authors items
   * with shared placeholder users and so `createdBy` is not enterprise-unique. Real wiring should
   * rely on `ids`.
   */
  matchNames?: string[]
}

/**
 * The single source of truth for 大客户 branding. Treat this as a configurable list — adding or
 * removing a customer is an edit to this array (see the HOW TO ADD note above). Swap to a
 * backend-populated list (`GET /api/enterprise-customers`) without touching call sites.
 */
export const ENTERPRISE_CUSTOMERS: EnterpriseConfig[] = [
  // item-skill-1 (Code Reviewer) → 招商银行 (red brand → red card)
  { name: "招商银行", logo: CMB_LOGO, ids: [], matchNames: ["Code Reviewer"] },
  // item-plugin-3 (Security Scanner) → 工商银行 (red brand → red card)
  { name: "工商银行", logo: ICBC_LOGO, ids: [], matchNames: ["Security Scanner"] },
  // item-mcp-2 (Database MCP) → 建设银行 (BLUE brand → blue card; control case proving the
  // extracted --bc tracks the logo's own dominant color, distinct from the two red banks above)
  { name: "建设银行", logo: CCB_LOGO, ids: [], matchNames: ["Database MCP"] },
]

function toEnterpriseInfo(config: EnterpriseConfig): EnterpriseInfo {
  return { name: config.name, logo: config.logo }
}

/**
 * Resolve enterprise branding for an item from its uploader account id (`createdBy`). A 大客户 may
 * own multiple account IDs, so we match when `createdBy` is any of a customer's configured ids.
 * Returns `null` when the uploader is not a configured enterprise.
 */
export function matchEnterprise(createdBy: string | undefined): EnterpriseInfo | null {
  if (!createdBy) return null
  const config = ENTERPRISE_CUSTOMERS.find((entry) => entry.ids?.includes(createdBy))
  return config ? toEnterpriseInfo(config) : null
}

/**
 * Demo-only fallback used when `createdBy` is not enterprise-unique (mock data): resolve by the
 * item's display name. Real backend wiring should rely on `matchEnterprise(createdBy)` instead.
 */
export function matchEnterpriseByName(name: string | undefined): EnterpriseInfo | null {
  if (!name) return null
  const config = ENTERPRISE_CUSTOMERS.find((entry) => entry.matchNames?.includes(name))
  return config ? toEnterpriseInfo(config) : null
}
