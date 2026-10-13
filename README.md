# @bombless/agent-lib

Reusable Node.js coding-agent runtime extracted from [chatgpt-mcp](https://github.com/bombless/chatgpt-mcp). Transport and product integrations should call this package instead of duplicating filesystem, command, Git, runtime, and browser/CDP tools.

## API

```ts
import { runAgentTool, AgentRequestSchema } from '@bombless/agent-lib';

const request = AgentRequestSchema.parse({ type: 'request', id: '1', tool: 'get_system_info', args: {} });
const result = await runAgentTool(request.tool, request.args, {
  logCommand: (command, cwd) => console.log(command, cwd ?? '')
});
```

- `runAgentTool(tool, args, options)` runs the same tool implementation used by chatgpt-mcp.
- `AgentRequestSchema`, `AgentResponseSchema`, and related Zod schemas define the shared transport contract.
- `cdpVersion`, `cdpListTargets`, and `cdpCall` expose the local Chrome DevTools Protocol helpers.

## Safety and configuration

The runtime honours `AGENT_WORKSPACE`, `ALLOW_COMMAND_EXECUTION`, `MAX_OUTPUT_BYTES`, `MAX_SEARCH_RESULTS`, and `COMMAND_TIMEOUT_MS`. Keep command execution disabled unless the host explicitly enables it. Filesystem operations are restricted to the configured workspace. CDP connects only to `127.0.0.1:9222`.

## Development

```sh
npm install
npm run typecheck
npm run build
```

Node.js 20 or newer is required. This package is ESM and ships TypeScript declarations in `dist/`.
