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
  resultFormat?: 'screenshot-images';
};

export const agentMcpTools: AgentMcpToolDefinition[] = [
  {
    name: 'get_screen_info',
    description: 'List all detected displays with index, device name, resolution, virtual-desktop coordinates, and primary-display status.',
    inputSchema: {},
    outputSchema: z.object({
      result: z.object({
        platform: z.string(),
        screens: z.array(z.object({
          index: z.number().int(), deviceName: z.string(), x: z.number(), y: z.number(),
          width: z.number(), height: z.number(), primary: z.boolean(),
        })),
      }),
    }),
  },
  {
    name: 'take_screenshot',
    description: 'Capture JPEG screenshots as image data for all displays, or one selected display. Optional x/y/width/height crop is display-relative and requires screenIndex.',
    inputSchema: {
      screenIndex: z.number().int().optional(),
      x: z.number().int().optional(), y: z.number().int().optional(),
      width: z.number().int().optional(), height: z.number().int().optional(),
    },
    outputSchema: z.object({
      result: z.object({
        screens: z.array(z.object({
          index: z.number().int(), deviceName: z.string(), x: z.number(), y: z.number(),
          width: z.number(), height: z.number(), primary: z.boolean(), captureX: z.number(),
          captureY: z.number(), captureWidth: z.number(), captureHeight: z.number(),
          mimeType: z.string(), data: z.string(), dataBytes: z.number(), dataSha256: z.string(),
        })),
      }),
    }),
    resultFormat: 'screenshot-images',
  },
  {
    name: 'get_screen_pixel',
    description: 'Probe one display-relative pixel and return RGB channels and hex without sending screenshot image data into model context. Call get_screen_info first to select a display and learn its bounds.',
    inputSchema: { screenIndex: z.number().int(), x: z.number().int(), y: z.number().int() },
    outputSchema: z.object({
      result: z.object({
        screenIndex: z.number().int(), deviceName: z.string(), x: z.number(), y: z.number(),
        absoluteX: z.number(), absoluteY: z.number(), r: z.number(), g: z.number(), b: z.number(),
        hex: z.string(), format: z.string(), note: z.string(),
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
