import type { Request, Response } from 'express';
import type { AgentEvent } from './chat.agent.js';
import type { ChatInput } from './chat.schemas.js';
import type { ChatService } from './chat.service.js';

const wantsStream = (req: Request) => (req.headers.accept ?? '').includes('text/event-stream');

export function createChatController(service: ChatService) {
  return async function chat(req: Request, res: Response) {
    const { companyId } = req.auth!;
    const input = req.body as ChatInput;

    if (!wantsStream(req)) {
      res.json(await service.reply(companyId, input));
      return;
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    try {
      await service.stream(
        companyId,
        input,
        (e: AgentEvent) => {
          if (e.type === 'text') send('text', { text: e.text });
          else if (e.type === 'tool') send('tool', { name: e.name });
          else send('done', {});
        },
        abort.signal,
      );
    } catch (err) {
      if (!abort.signal.aborted) {
        console.error(err);
        send('error', { message: 'Não foi possível obter a resposta do agente' });
      }
    }
    res.end();
  };
}
