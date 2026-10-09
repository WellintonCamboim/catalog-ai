import type {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type { ContentBlock, LlmTurn, MessageParam, Tool } from './llm.js';

// The agent speaks the neutral format from llm.ts (text / tool_use / tool_result blocks); these
// helpers translate it to and from the OpenAI chat-completions format used by OpenRouter.

export function toOpenAiTools(tools: Tool[]): ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

export function toOpenAiMessages(
  system: string,
  messages: MessageParam[],
): ChatCompletionMessageParam[] {
  const out: ChatCompletionMessageParam[] = [{ role: 'system', content: system }];

  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content });
      continue;
    }

    if (m.role === 'assistant') {
      const text = m.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
      const toolCalls = m.content.flatMap((b) =>
        b.type === 'tool_use'
          ? [
              {
                id: b.id,
                type: 'function' as const,
                function: { name: b.name, arguments: JSON.stringify(b.input) },
              },
            ]
          : [],
      );
      out.push({
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
      });
      continue;
    }

    for (const b of m.content) {
      if (b.type === 'tool_result') {
        out.push({ role: 'tool', tool_call_id: b.tool_use_id, content: String(b.content ?? '') });
      } else if (b.type === 'text') {
        out.push({ role: 'user', content: b.text });
      }
    }
  }
  return out;
}

function parseArguments(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    // Invalid JSON from the model: the tool's schema validation will report it back as an error.
    return null;
  }
}

export async function collectStream(
  chunks: AsyncIterable<ChatCompletionChunk>,
  onText: (delta: string) => void,
): Promise<LlmTurn> {
  let text = '';
  let finishReason: string | null = null;
  const calls = new Map<number, { id: string; name: string; args: string }>();

  for await (const chunk of chunks) {
    const choice = chunk.choices[0];
    if (!choice) continue;

    // delta.reasoning (if any) is intentionally ignored: only the final answer reaches the user.
    // Some models open their turn with blank lines, so leading whitespace is dropped.
    const delta = text ? choice.delta.content : choice.delta.content?.trimStart();
    if (delta) {
      text += delta;
      onText(delta);
    }
    for (const tc of choice.delta.tool_calls ?? []) {
      const call = calls.get(tc.index) ?? { id: '', name: '', args: '' };
      call.id ||= tc.id ?? '';
      call.name ||= tc.function?.name ?? '';
      call.args += tc.function?.arguments ?? '';
      calls.set(tc.index, call);
    }
    if (choice.finish_reason) finishReason = choice.finish_reason;
  }

  const content: ContentBlock[] = [];
  if (text) content.push({ type: 'text', text });
  for (const [index, c] of [...calls.entries()].sort((a, b) => a[0] - b[0])) {
    content.push({
      type: 'tool_use',
      id: c.id || `call_${index}`,
      name: c.name,
      input: parseArguments(c.args),
    });
  }

  const usedTools = calls.size > 0 || finishReason === 'tool_calls';
  return { content, stopReason: usedTools ? 'tool_use' : (finishReason ?? 'end_turn') };
}
