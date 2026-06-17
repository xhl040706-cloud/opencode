import type { Device, Workspace } from "../types"

/** Demo 设备 ID — 与 vite.js 的 DEVICE_PROXY_PREFIX 对齐 */
export const DEMO_DEVICE_ID = "demo-device"

/** Demo 工作空间 ID */
export const DEMO_WORKSPACE_ID = "hrm-approval-demo"

/** Demo 目录路径 */
export const DEMO_DIRECTORY = "/Users/demo/Projects/costrict-hrm-demo"

/** Demo 会话 ID */
export const DEMO_SESSION_ID = "demo-session-approval-fix"

/** Demo 设备 */
export const demoDevice: Device = {
  id: DEMO_DEVICE_ID,
  deviceId: DEMO_DEVICE_ID,
  displayName: "Demo-MacBook-Pro",
  platform: "darwin",
  version: "Demo 1.0.0",
  userId: "demo-user",
  status: "online",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
}

/** Demo 工作空间 */
export const demoWorkspace: Workspace = {
  id: DEMO_WORKSPACE_ID,
  name: "HRM 审批示例空间",
  userId: "demo-user",
  deviceId: DEMO_DEVICE_ID,
  deviceUniqueId: DEMO_DEVICE_ID,
  isDefault: true,
  status: "active",
  deviceStatus: "online",
  directories: [
    {
      id: "demo-directory",
      workspaceId: DEMO_WORKSPACE_ID,
      name: "costrict-hrm-demo",
      path: DEMO_DIRECTORY,
      isDefault: true,
      orderIndex: 0,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
}
