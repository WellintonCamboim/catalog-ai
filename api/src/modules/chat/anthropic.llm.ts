import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import type { LlmClient, LlmRequest, LlmTurn } from './llm.js';

const MAX_TOKENS = 1024;

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY)
    throw new AppError(503, 'Agente de IA indisponível: ANTHROPIC_API_KEY não configurada');
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 2 });
  return client;
}

export const anthropicLlm: LlmClient = {
  async streamTurn({ system, messages, tools, signal, onText }: LlmRequest): Promise<LlmTurn> {
    const stream = getClient().messages.stream(
      { model: env.LLM_MODEL, max_tokens: MAX_TOKENS, system, messages, tools },
      { signal },
    );
    stream.on('text', onText);
    const message = await stream.finalMessage();
    return { content: message.content, stopReason: message.stop_reason };
  },
};
