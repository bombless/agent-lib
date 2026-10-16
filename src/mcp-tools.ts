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
    name: 'read_file',
    description: 'Read a UTF-8 file with physical 1-based line numbers. For large files, specify startLine and endLine to read a bounded range.',
    inputSchema: { path: z.string().min(1), startLine: z.number().int().min(1).optional(), endLine: z.number().int().min(1).optional() },
    outputSchema: z.object({ result: z.unknown() }),
  },
  {
    name: 'replace_lines',
    description: 'Replace an exact inclusive 1-based line range. The supplied oldText must exactly match the current range; mismatches do not modify the file. Empty newText deletes the range. Preserves LF/CRLF style.',
    inputSchema: {
      path: z.string().min(1), startLine: z.number().int().min(1), endLine: z.number().int().min(1),
      oldText: z.string(), newText: z.string(),
    },
    outputSchema: z.object({ result: z.unknown() }),
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
