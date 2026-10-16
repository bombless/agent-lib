import * as z from 'zod';

/**
 * MCP-facing metadata for an agent-lib capability.
 *
 * Keep transport-independent execution in runAgentTool(); add the MCP-facing
 * name, description, argument shape, and result schema here. chatgpt-mcp
 * discovers these definitions at startup, so new shared tools do not require
 * a matching registration change in chatgpt-mcp.
 */
export type AgentMcpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodType>;
  outputSchema: z.ZodType;
};

export const agentMcpTools: AgentMcpToolDefinition[] = [
  {
    name: 'test_proxy_7897',
    description: 'Test HTTP/HTTPS connectivity through the local HTTP proxy at 127.0.0.1:7897. Defaults to https://www.google.com.',
    inputSchema: { url: z.string().url().default('https://www.google.com') },
    outputSchema: z.object({
      result: z.object({
        ok: z.boolean(), url: z.string(), proxy: z.string(), proxyConnected: z.boolean(),
        status: z.number().int().optional(), statusText: z.string().optional(),
        elapsedMs: z.number(), error: z.string().optional(),
      }),
    }),
  },
  {
    name: 'get_system_info',
    description: 'Get basic system information from the connected agent.',
    inputSchema: {},
    outputSchema: z.object({
      result: z.object({
        hostname: z.string(),
        platform: z.string(),
        arch: z.string(),
        release: z.string(),
        workspace: z.string(),
        commandExecutionEnabled: z.boolean(),
      }),
    }),
  },
];
