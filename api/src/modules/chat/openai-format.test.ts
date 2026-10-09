import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import { describe, expect, it } from 'vitest';
import type { MessageParam } from './llm.js';
import { collectStream, toOpenAiMessages } from './openai-format.js';

async function* chunks(...deltas: Partial<ChatCompletionChunk['choices'][0]>[]) {
  for (const c of deltas) {
    yield { choices: [{ index: 0, delta: {}, finish_reason: null, ...c }] } as ChatCompletionChunk;
  }
}

describe('toOpenAiMessages', () => {
  it('translates tool_use and tool_result blocks', () => {
    const messages: MessageParam[] = [
      { role: 'user', content: 'tem camiseta?' },
      {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'c1', name: 'search_products', input: { query: 'camiseta' } },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'c1', content: '{"total_matches":1}' }],
      },
    ];
    expect(toOpenAiMessages('sys', messages)).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'tem camiseta?' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'c1',
            type: 'function',
            function: { name: 'search_products', arguments: '{"query":"camiseta"}' },
          },
        ],
      },
      { role: 'tool', tool_call_id: 'c1', content: '{"total_matches":1}' },
    ]);
  });
});

describe('collectStream', () => {
  it('streams text deltas and ignores reasoning', async () => {
    const seen: string[] = [];
    const turn = await collectStream(
      chunks(
        { delta: { reasoning: 'pensando...' } as never },
        { delta: { content: '\n\n' } },
        { delta: { content: '\n Olá' } },
        { delta: { content: ' mundo' }, finish_reason: 'stop' },
      ),
      (t) => seen.push(t),
    );
    expect(seen).toEqual(['Olá', ' mundo']);
    expect(turn.content).toEqual([{ type: 'text', text: 'Olá mundo' }]);
    expect(turn.stopReason).toBe('stop');
  });

  it('assembles tool calls split across chunks', async () => {
    const turn = await collectStream(
      chunks(
        {
          delta: {
            tool_calls: [
              { index: 0, id: 'c1', function: { name: 'search_products', arguments: '{"que' } },
            ],
          },
        },
        {
          delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"fone"}' } }] },
          finish_reason: 'tool_calls',
        },
      ),
      () => {},
    );
    expect(turn.stopReason).toBe('tool_use');
    expect(turn.content).toEqual([
      { type: 'tool_use', id: 'c1', name: 'search_products', input: { query: 'fone' } },
    ]);
  });

  it('keeps going with null input when the arguments are not valid JSON', async () => {
    const turn = await collectStream(
      chunks({
        delta: {
          tool_calls: [{ index: 0, id: 'c1', function: { name: 'x', arguments: '{oops' } }],
        },
        finish_reason: 'tool_calls',
      }),
      () => {},
    );
    expect(turn.content[0]).toMatchObject({ type: 'tool_use', input: null });
  });
});
