import { env } from '../../config/env.js';
import { anthropicLlm } from './anthropic.llm.js';
import type { LlmClient } from './llm.js';
import { openRouterLlm } from './openrouter.llm.js';

export function createLlmFromEnv(): LlmClient {
  return env.LLM_PROVIDER === 'openrouter' ? openRouterLlm : anthropicLlm;
}
