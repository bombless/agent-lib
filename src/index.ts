import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
export { assertAllowed, runCodingTool, testHttpProxy } from './coding-tools.js';
export { cdpCall, cdpListTargets, cdpVersion } from './cdp.js';
export { AgentHelloSchema, AgentMessageSchema, AgentRequestSchema, AgentResponseSchema } from './protocol.js';
export { agentMcpTools } from './mcp-tools.js';
export type { AgentMcpToolDefinition } from './mcp-tools.js';
export type { AgentHello, AgentMessage, AgentRequest, AgentResponse } from './protocol.js';
export { geocodeLocation, runOpenMeteoTool } from './open-meteo.js';
import { assertAllowed, runCodingTool } from './coding-tools.js';
import { runOpenMeteoTool } from './open-meteo.js';

export type AgentRuntimeOptions = { logCommand?: (command: string, cwd?: string) => void };

/** Execute an agent tool independently of any transport (MCP, Feishu, CLI, etc.). */
export async function runAgentTool(tool: string, args: Record<string, unknown> = {}, options: AgentRuntimeOptions = {}): Promise<unknown> {
  switch (tool) {
    case 'read_file': return await fs.readFile(assertAllowed(String(args.path ?? '')), 'utf8');
    case 'write_file': {
      const file = assertAllowed(String(args.path ?? ''));
      await fs.writeFile(file, String(args.content ?? ''), 'utf8');
      return { ok: true, path: file };
    }
    case 'list_directory': {
      const dir = assertAllowed(String(args.path ?? ''));
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.map(entry => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }));
    }
    case 'move_file': {
      const source = assertAllowed(String(args.source ?? ''));
      const destination = assertAllowed(String(args.destination ?? ''));
      await fs.rename(source, destination);
      return { ok: true, source, destination };
    }
    case 'delete_file': {
      const target = assertAllowed(String(args.path ?? ''));
      const stat = await fs.lstat(target);
      if (stat.isDirectory()) await fs.rmdir(target); else await fs.unlink(target);
      return { ok: true, path: target };
    }
    case 'get_system_info':
      return { hostname: os.hostname(), platform: process.platform, arch: process.arch, release: os.release(), workspace: path.resolve(process.env.AGENT_WORKSPACE ?? (process.platform === 'linux' ? '/tmp/mcp-agent-workspace' : 'D:\\\\mcp-agent-workspace')), commandExecutionEnabled: process.env.ALLOW_COMMAND_EXECUTION === 'true' };
    case 'geocode_location':
    case 'get_weather_forecast':
    case 'get_historical_weather':
      return await runOpenMeteoTool(tool, args);
    default: return await runCodingTool(tool, args, options.logCommand);
  }
}
