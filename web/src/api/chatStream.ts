import { ApiError, authHeaders, BASE_URL, toApiError } from './client';
import type { ChatMessage } from './types';

export interface ChatHandlers {
  onText: (text: string) => void;
  onTool: (name: string) => void;
}

// fetch + ReadableStream instead of EventSource: EventSource cannot POST or send an Authorization header.
export async function streamChat(
  message: string,
  history: ChatMessage[],
  handlers: ChatHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
      body: JSON.stringify({ message, history }),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ApiError(0, 'Não foi possível conectar ao servidor');
  }
  if (!res.ok) throw await toApiError(res);
  if (!res.body) throw new ApiError(0, 'Resposta sem conteúdo');

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;

    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const event = /^event: (.+)$/m.exec(raw)?.[1];
      const data = /^data: (.+)$/m.exec(raw)?.[1];
      const payload = data ? JSON.parse(data) : {};

      if (event === 'text') handlers.onText(payload.text);
      else if (event === 'tool') handlers.onTool(payload.name);
      else if (event === 'error') throw new ApiError(502, payload.message);
    }
  }
}
