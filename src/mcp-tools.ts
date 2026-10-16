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
