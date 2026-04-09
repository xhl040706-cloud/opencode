import type { OpencodeClient } from "@opencode-ai/sdk/v2/client"

export function workspaceAdapter(sdk: OpencodeClient) {
  return {
    health: () => sdk.global.health(),
    path: () => sdk.path.get(),
    agents: () => sdk.app.agents(),
    sessionGet: (sessionID: string) => sdk.session.get({ sessionID }),
    sessionList: (directory?: string) => (directory ? sdk.session.list({ directory }) : sdk.session.list()),
    sessionMessages: (sessionID: string, directory: string, limit: number) => sdk.session.messages({ sessionID, directory, limit }),
    sessionStatus: () => sdk.session.status(),
    sessionDiff: (sessionID: string) => sdk.session.diff({ sessionID }),
    sessionTodo: (sessionID: string) => sdk.session.todo({ sessionID }),
    sessionCreate: () => sdk.session.create(),
    sessionUpdate: (input: Parameters<OpencodeClient["session"]["update"]>[0]) => sdk.session.update(input),
    sessionDelete: (sessionID: string) => sdk.session.delete({ sessionID }),
    sessionAbort: (sessionID: string) => sdk.session.abort({ sessionID }),
    sessionRevert: (sessionID: string, messageID: string) => sdk.session.revert({ sessionID, messageID }),
    sessionUnrevert: (sessionID: string) => sdk.session.unrevert({ sessionID }),
    sessionSummarize: (input: Parameters<OpencodeClient["session"]["summarize"]>[0]) => sdk.session.summarize(input),
    sessionShell: (input: Parameters<OpencodeClient["session"]["shell"]>[0]) => sdk.session.shell(input),
    sessionCommand: (input: Parameters<OpencodeClient["session"]["command"]>[0]) => sdk.session.command(input),
    sessionPromptAsync: (input: Parameters<OpencodeClient["session"]["promptAsync"]>[0]) =>
      sdk.session.promptAsync(input),
    sessionShare: (sessionID: string, directory: string) => sdk.session.share({ sessionID, directory }),
    sessionUnshare: (sessionID: string, directory: string) => sdk.session.unshare({ sessionID, directory }),
    worktreeCreate: (directory: string) => sdk.worktree.create({ directory }),
    permissions: () => sdk.permission.list(),
    questions: () => sdk.question.list(),
    questionReply: (requestID: string, answers: Parameters<OpencodeClient["question"]["reply"]>[0]["answers"]) =>
      sdk.question.reply({ requestID, answers }),
    questionReject: (requestID: string) => sdk.question.reject({ requestID }),
  }
}
