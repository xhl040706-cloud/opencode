export function workspaceAdapter(sdk: any) {
  return {
    health: () => sdk.runtime.health().then((data) => ({ data })),
    path: () => sdk.runtime.targetContext().then((data) => ({ data })),
    sessionModes: () => sdk.runtime.sessionModes().then((data) => ({ data })),
    agentRuntimes: () => sdk.runtime.agentRuntimes().then((data) => ({ data })),
    sessionGet: (sessionID: string) => sdk.conversation.get(sessionID).then((data) => ({ data })),
    sessionList: (directory?: string) => sdk.conversation.list(directory ? { directory } : undefined).then((data) => ({ data })),
    sessionMessages: (sessionID: string, directory: string, limit: number) =>
      sdk.conversation.messages(sessionID, { directory, limit }).then((data) => ({ data })),
    sessionStatus: () => sdk.conversation.status().then((data) => ({ data })),
    sessionDiff: (sessionID: string) => sdk.conversation.diff(sessionID).then((data) => ({ data })),
    sessionTodo: (sessionID: string) => sdk.conversation.todo(sessionID).then((data) => ({ data })),
    sessionCreate: () => sdk.conversation.create().then((data) => ({ data })),
    sessionUpdate: (input: { sessionID: string } & Record<string, unknown>) =>
      sdk.conversation.update(input.sessionID, input).then((data) => ({ data })),
    sessionDelete: (sessionID: string) => sdk.conversation.delete(sessionID).then((data) => ({ data })),
    sessionAbort: (sessionID: string) => sdk.conversation.abort(sessionID).then((data) => ({ data })),
    sessionShell: (input: { sessionID: string } & Record<string, unknown>) =>
      sdk.conversation.shell(input.sessionID, input).then((data) => ({ data })),
    sessionCommand: (input: { sessionID: string } & Record<string, unknown>) =>
      sdk.conversation.command(input.sessionID, input).then((data) => ({ data })),
    sessionPromptAsync: (input: { sessionID: string } & Record<string, unknown>) =>
      sdk.conversation.promptAsync(input.sessionID, input).then((data) => ({ data })),
    worktreeCreate: (directory: string) => sdk.raw.worktree.create({ directory }),
    permissions: () => sdk.interaction.permissions().then((data) => ({ data })),
    questions: () => sdk.interaction.questions().then((data) => ({ data })),
    questionReply: (requestID: string, answers: unknown) => sdk.interaction.questionReply(requestID, { answers }).then((data) => ({ data })),
    questionReject: (requestID: string) => sdk.interaction.questionReject(requestID).then((data) => ({ data })),
  }
}
