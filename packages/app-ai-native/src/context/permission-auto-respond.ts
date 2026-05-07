export function acceptKey(sessionID: string, workspaceId?: string) {
  if (!workspaceId) return sessionID
  return `${workspaceId}/${sessionID}`
}

function accepted(autoAccept: Record<string, boolean>, sessionID: string, workspaceId?: string) {
  const key = acceptKey(sessionID, workspaceId)
  return autoAccept[key] ?? autoAccept[sessionID]
}

function sessionLineage(session: { id: string; parentID?: string }[], sessionID: string) {
  const parent = session.reduce((acc, item) => {
    if (item.parentID) acc.set(item.id, item.parentID)
    return acc
  }, new Map<string, string>())
  const seen = new Set([sessionID])
  const ids = [sessionID]

  for (const id of ids) {
    const parentID = parent.get(id)
    if (!parentID || seen.has(parentID)) continue
    seen.add(parentID)
    ids.push(parentID)
  }

  return ids
}

export function autoRespondsPermission(
  autoAccept: Record<string, boolean>,
  session: { id: string; parentID?: string }[],
  permission: { sessionID: string },
  workspaceId?: string,
) {
  const value = sessionLineage(session, permission.sessionID)
    .map((id) => accepted(autoAccept, id, workspaceId))
    .find((item): item is boolean => item !== undefined)
  return value ?? false
}
