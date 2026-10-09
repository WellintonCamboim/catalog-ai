import type { ContentBlock, MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';

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
