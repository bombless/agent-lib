export { assertAllowed, runCodingTool, testHttpProxy } from './coding-tools.js';
export { cdpCall, cdpListTargets, cdpVersion } from './cdp.js';
export { AgentHelloSchema, AgentMessageSchema, AgentRequestSchema, AgentResponseSchema } from './protocol.js';
export type { AgentHello, AgentMessage, AgentRequest, AgentResponse } from './protocol.js';

import { runCodingTool } from './coding-tools.js';

export type AgentRuntimeOptions = {
  /** Optional logger called with a sanitized display string and working directory. */
  logCommand?: (command: string, cwd?: string) => void;
};

/** Execute a shared coding-agent tool independently of any transport (MCP, Feishu, CLI, etc.). */
export async function runAgentTool(tool: string, args: Record<string, unknown> = {}, options: AgentRuntimeOptions = {}): Promise<unknown> {
  return await runCodingTool(tool, args, options.logCommand);
}
