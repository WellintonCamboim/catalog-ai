import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { streamChat } from './chatStream';

function sseResponse(chunks: string[], init: ResponseInit = { status: 200 }) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, init);
}

const run = (chunks: string[]) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(chunks)));
  const events: string[] = [];
  const done = streamChat(
    'oi',
    [],
    { onText: (t) => events.push(`text:${t}`), onTool: (n) => events.push(`tool:${n}`) },
    new AbortController().signal,
  );
  return { events, done };
};

afterEach(() => vi.unstubAllGlobals());

describe('streamChat', () => {
  it('dispatches text and tool events in order', async () => {
    const { events, done } = run([
      'event: tool\ndata: {"name":"search_products"}\n\n',
      'event: text\ndata: {"text":"Olá"}\n\nevent: text\ndata: {"text":" mundo"}\n\n',
      'event: done\ndata: {}\n\n',
    ]);
    await done;
    expect(events).toEqual(['tool:search_products', 'text:Olá', 'text: mundo']);
  });

  it('reassembles events split across network chunks', async () => {
    const { events, done } = run(['event: te', 'xt\ndata: {"text":"Ol', 'á"}\n', '\n']);
    await done;
    expect(events).toEqual(['text:Olá']);
  });

  it('sends the token, the SSE accept header and the history', async () => {
    localStorage.setItem('token', 'jwt-123');
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    const history = [{ role: 'user' as const, content: 'antes' }];
    await streamChat('depois', history, { onText: () => {}, onTool: () => {} }, new AbortController().signal);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/chat');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer jwt-123', Accept: 'text/event-stream' });
    expect(JSON.parse(init.body)).toEqual({ message: 'depois', history });
  });

  it('throws an ApiError on a server-sent error event', async () => {
    const { done } = run(['event: error\ndata: {"message":"falhou"}\n\n']);
    await expect(done).rejects.toMatchObject({ message: 'falhou' });
  });

  it('turns an HTTP error into an ApiError with the server message', async () => {
    const res = new Response(JSON.stringify({ error: { message: 'Agente indisponível' } }), { status: 503 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    const call = streamChat('oi', [], { onText: () => {}, onTool: () => {} }, new AbortController().signal);
    await expect(call).rejects.toBeInstanceOf(ApiError);
    await expect(call).rejects.toMatchObject({ status: 503, message: 'Agente indisponível' });
  });
});
