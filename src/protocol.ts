import { z } from 'zod';

export const AgentRequestSchema = z.object({ type: z.literal('request'), id: z.string().min(1), tool: z.string().min(1), args: z.record(z.string(), z.unknown()).default({}) });
export const AgentResponseSchema = z.object({ type: z.literal('response'), id: z.string().min(1), ok: z.boolean(), result: z.unknown().optional(), error: z.string().optional() });
export const AgentHelloSchema = z.object({ type: z.literal('hello'), agentId: z.string(), hostname: z.string(), platform: z.string(), version: z.string() });
export const AgentMessageSchema = z.union([AgentHelloSchema, AgentResponseSchema]);
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
export type AgentHello = z.infer<typeof AgentHelloSchema>;
export type AgentMessage = z.infer<typeof AgentMessageSchema>;
