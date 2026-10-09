import { unauthorized } from '../../lib/errors.js';
import { Company } from '../companies/company.model.js';
import { runAgent, type AgentEvent } from './chat.agent.js';
import type { ChatInput } from './chat.schemas.js';
import type { LlmClient } from './llm.js';

export function createChatService(llm: LlmClient) {
  async function run(
    companyId: string,
    input: ChatInput,
    emit: (event: AgentEvent) => void,
    signal?: AbortSignal,
  ) {
    const company = await Company.findById(companyId).lean();
    if (!company) throw unauthorized('Empresa não encontrada');

    await runAgent({
      llm,
      ctx: { companyId },
      companyName: company.name,
      message: input.message,
      history: input.history,
      emit,
      signal,
    });
  }

  return {
    stream: run,

    async reply(companyId: string, input: ChatInput) {
      let reply = '';
      const tools: string[] = [];
      await run(companyId, input, (event) => {
        if (event.type === 'text') reply += event.text;
        if (event.type === 'tool') tools.push(event.name);
      });
      return { reply, toolCalls: tools };
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
