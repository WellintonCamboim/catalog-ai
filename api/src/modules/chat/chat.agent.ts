import type {
  ContentBlock,
  ContentBlockParam,
  MessageParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages';
import type { LlmClient } from './llm.js';
import { buildSystemPrompt } from './chat.prompt.js';
import { executeTool, toolDefinitions, type ToolContext } from './chat.tools.js';

const MAX_ITERATIONS = 5;
const GIVE_UP_MESSAGE = 'Não consegui concluir a consulta. Pode reformular a pergunta?';

export type AgentEvent =
  { type: 'text'; text: string } | { type: 'tool'; name: string } | { type: 'done' };

export interface AgentRun {
  llm: LlmClient;
  ctx: ToolContext;
  companyName: string;
  message: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  emit: (event: AgentEvent) => void;
  signal?: AbortSignal;
}

// Only text and tool_use blocks go back to the model; other block types are not needed for the loop.
function toAssistantParam(content: ContentBlock[]): ContentBlockParam[] {
  return content.flatMap((block): ContentBlockParam[] => {
    if (block.type === 'text') return [{ type: 'text', text: block.text }];
    if (block.type === 'tool_use') {
      return [{ type: 'tool_use', id: block.id, name: block.name, input: block.input }];
    }
    return [];
  });
}

export async function runAgent({
  llm,
  ctx,
  companyName,
  message,
  history,
  emit,
  signal,
}: AgentRun) {
  const system = buildSystemPrompt(companyName);
  const messages: MessageParam[] = [...history, { role: 'user', content: message }];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const turn = await llm.streamTurn({
      system,
      messages,
      tools: toolDefinitions,
      signal,
      onText: (text) => emit({ type: 'text', text }),
    });

    const toolUses = turn.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
    if (turn.stopReason !== 'tool_use' || toolUses.length === 0) {
      emit({ type: 'done' });
      return;
    }

    messages.push({ role: 'assistant', content: toAssistantParam(turn.content) });
    const results = [];
    for (const use of toolUses) {
      emit({ type: 'tool', name: use.name });
      results.push(await executeTool(ctx, use.id, use.name, use.input));
    }
    messages.push({ role: 'user', content: results });
  }

  emit({ type: 'text', text: GIVE_UP_MESSAGE });
  emit({ type: 'done' });
}
