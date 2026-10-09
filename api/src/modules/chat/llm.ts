// Provider-agnostic conversation format used by the agent loop. Provider adapters (see
// openai-format.ts) translate it to and from their wire format.

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock;

export type MessageParam =
  | { role: 'user'; content: string | (TextBlock | ToolResultBlock)[] }
  | { role: 'assistant'; content: string | ContentBlock[] };

export interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmTurn {
  content: ContentBlock[];
  stopReason: string | null;
}

export interface LlmRequest {
  system: string;
  messages: MessageParam[];
  tools: Tool[];
  signal?: AbortSignal;
  onText: (delta: string) => void;
}

// The agent depends on this interface only, so tests can script the model's behaviour.
export interface LlmClient {
  streamTurn(request: LlmRequest): Promise<LlmTurn>;
}
