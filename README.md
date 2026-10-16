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

## Open-Meteo weather tools

The runtime also exposes three network-backed tools through `runAgentTool`:

- `geocode_location` — args: `{ location: string }`; resolves a place to coordinates and timezone.
- `get_weather_forecast` — args: `{ location: string }`; returns current conditions and a seven-day daily forecast.
- `get_historical_weather` — args: `{ location: string, start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD', variables?: string[], timezone?: string }`; returns daily historical observations. Allowed variables: `weather_code`, `temperature_2m_max`, `temperature_2m_min`, `temperature_2m_mean`, `sunshine_duration`, `precipitation_sum`, `rain_sum`, and `wind_speed_10m_max`.

The weather tools use Open-Meteo's public Geocoding, Forecast, and Historical Weather APIs and require no API key for normal non-commercial use. Historical results include Open-Meteo attribution (CC BY 4.0). Hosts that expose tools to a model should add matching tool descriptions/schemas to their own tool catalog.

## Safety and configuration

The runtime honours `AGENT_WORKSPACE`, `ALLOW_COMMAND_EXECUTION`, `MAX_OUTPUT_BYTES`, `MAX_SEARCH_RESULTS`, and `COMMAND_TIMEOUT_MS`. Keep command execution disabled unless the host explicitly enables it. Filesystem operations are restricted to the configured workspace. CDP connects only to `127.0.0.1:9222`.

## Development

```sh
npm install
npm run typecheck
npm run build
```

Node.js 20 or newer is required. This package is ESM and ships TypeScript declarations in `dist/`.

## MCP tool registration

The package exports `agentMcpTools`, a list of MCP-facing tool definitions
(name, description, Zod input shape, and output schema). The `chatgpt-mcp`
server registers these definitions automatically at startup.

When adding a reusable tool, implement it in `runAgentTool()` (or the shared
runtime it delegates to) and add its MCP metadata to `src/mcp-tools.ts`.
That keeps execution and public tool metadata in `agent-lib`; consumers that
integrate `agentMcpTools` do not need a separate registration change for each
new tool. Keep transport-specific tools in the consuming application.
