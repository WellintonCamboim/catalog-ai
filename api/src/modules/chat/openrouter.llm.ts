import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { AppError } from '../../lib/errors.js';
import type { LlmClient, LlmRequest, LlmTurn } from './llm.js';
import { collectStream, toOpenAiMessages, toOpenAiTools } from './openai-format.js';

const MAX_TOKENS = 1024;

let client: OpenAI | undefined;

function getClient(): OpenAI {
  if (!env.OPENROUTER_API_KEY) {
    throw new AppError(503, 'Agente de IA indisponível: OPENROUTER_API_KEY não configurada');
  }
  client ??= new OpenAI({
    apiKey: env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    timeout: 60_000,
    maxRetries: 2,
  });
  return client;
}

export const openRouterLlm: LlmClient = {
  async streamTurn({ system, messages, tools, signal, onText }: LlmRequest): Promise<LlmTurn> {
    const stream = await getClient().chat.completions.create(
      {
        model: env.LLM_MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        messages: toOpenAiMessages(system, messages),
        tools: toOpenAiTools(tools),
      },
      { signal },
    );
    return collectStream(stream, onText);
  },
};
