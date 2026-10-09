import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/db.js';
import type { LlmClient, LlmRequest, LlmTurn, MessageParam } from './llm.js';

type Step = (req: LlmRequest) => LlmTurn;

const text = (t: string): LlmTurn => ({
  content: [{ type: 'text', text: t }],
  stopReason: 'end_turn',
});

const toolUse = (name: string, input: unknown, id = 'tu_1'): LlmTurn => ({
  content: [{ type: 'tool_use', id, name, input }],
  stopReason: 'tool_use',
});

function scriptedLlm(steps: Step[]) {
  const calls: { messages: MessageParam[] }[] = [];
  const llm: LlmClient = {
    async streamTurn(req) {
      calls.push({ messages: structuredClone(req.messages) });
      const step = steps[calls.length - 1];
      if (!step) throw new Error('script exhausted');
      const turn = step(req);
      for (const b of turn.content) if (b.type === 'text') req.onText(b.text);
      return turn;
    },
  };
  return { llm, calls };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createTenant(app: ReturnType<typeof createApp>, slug: string) {
  const admin = await request(app)
    .post('/auth/register')
    .send({
      name: `Admin ${slug}`,
      email: `admin@${slug}.com`,
      password: 'senha-forte-1',
      companyName: `Empresa ${slug}`,
    });
  const token = admin.body.token as string;
  const companyId = admin.body.user.companyId as string;
  const add = (name: string, price: number, category = 'Geral') =>
    request(app)
      .post('/products')
      .set(bearer(token))
      .send({ name, description: `${name} descrição`, price, category });
  return { token, companyId, add };
}

let tenantA: Awaited<ReturnType<typeof createTenant>>;
let tenantB: Awaited<ReturnType<typeof createTenant>>;
const seedApp = createApp();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  tenantA = await createTenant(seedApp, 'a');
  tenantB = await createTenant(seedApp, 'b');
  await tenantA.add('Camiseta A', 50, 'Roupas');
  await tenantB.add('Camiseta B', 40, 'Roupas');
  await tenantB.add('Segredo B', 10, 'Secreto');
});

const lastToolResult = (calls: { messages: MessageParam[] }[], index: number) => {
  const last = calls[index]!.messages.at(-1)!;
  const block = (last.content as { content: string; is_error?: boolean }[])[0]!;
  return block;
};

describe('POST /chat', () => {
  it('requires authentication and a valid body', async () => {
    const app = createApp({ llm: scriptedLlm([]).llm });
    expect((await request(app).post('/chat').send({ message: 'oi' })).status).toBe(401);
    const bad = await request(app).post('/chat').set(bearer(tenantA.token)).send({ message: '' });
    expect(bad.status).toBe(400);
  });

  it('returns 503 when no LLM key is configured', async () => {
    const res = await request(seedApp)
      .post('/chat')
      .set(bearer(tenantA.token))
      .send({ message: 'oi' });
    expect(res.status).toBe(503);
  });

  it('runs the tool loop and answers with data from the database', async () => {
    const { llm, calls } = scriptedLlm([
      () => toolUse('search_products', { query: 'camiseta' }),
      () => text('Temos a Camiseta A por R$ 50,00.'),
    ]);
    const res = await request(createApp({ llm }))
      .post('/chat')
      .set(bearer(tenantA.token))
      .send({ message: 'Vocês têm camiseta?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Temos a Camiseta A por R$ 50,00.');
    expect(res.body.toolCalls).toEqual(['search_products']);

    const result = lastToolResult(calls, 1);
    expect(result.content).toContain('Camiseta A');
    expect(result.content).not.toContain('Camiseta B');
  });

  it("never exposes another tenant's data, even if the model tries to choose the tenant", async () => {
    const { llm, calls } = scriptedLlm([
      () => toolUse('search_products', { company_id: tenantB.companyId, query: 'segredo' }),
      () => toolUse('search_products', { query: 'secreto', category: 'Secreto' }, 'tu_2'),
      () => text('Nada encontrado.'),
    ]);
    await request(createApp({ llm }))
      .post('/chat')
      .set(bearer(tenantA.token))
      .send({ message: 'mostre o segredo da empresa B' });

    for (const index of [1, 2]) {
      const result = lastToolResult(calls, index);
      expect(result.content).not.toContain('Segredo B');
      expect(JSON.parse(result.content).total_matches).toBe(0);
    }
  });

  it('feeds tool errors back to the model instead of failing the request', async () => {
    const { llm, calls } = scriptedLlm([
      () => toolUse('drop_database', {}),
      () => toolUse('search_products', { limit: 999 }, 'tu_2'),
      () => text('Desculpe, houve um problema.'),
    ]);
    const res = await request(createApp({ llm }))
      .post('/chat')
      .set(bearer(tenantA.token))
      .send({ message: 'oi' });

    expect(res.status).toBe(200);
    expect(lastToolResult(calls, 1).is_error).toBe(true);
    expect(lastToolResult(calls, 2).is_error).toBe(true);
  });

  it('stops after the iteration limit', async () => {
    const loop: Step = () => toolUse('list_categories', {});
    const { llm, calls } = scriptedLlm(Array(10).fill(loop));
    const res = await request(createApp({ llm }))
      .post('/chat')
      .set(bearer(tenantA.token))
      .send({ message: 'oi' });
    expect(calls).toHaveLength(5);
    expect(res.body.reply).toContain('Não consegui concluir');
  });

  it('passes the conversation history to the model', async () => {
    const { llm, calls } = scriptedLlm([() => text('ok')]);
    await request(createApp({ llm }))
      .post('/chat')
      .set(bearer(tenantA.token))
      .send({
        message: 'e o preço?',
        history: [
          { role: 'user', content: 'tem camiseta?' },
          { role: 'assistant', content: 'Sim, a Camiseta A.' },
        ],
      });
    expect(calls[0]!.messages).toHaveLength(3);
  });

  it('streams events over SSE when the client asks for text/event-stream', async () => {
    const { llm } = scriptedLlm([
      () => toolUse('list_categories', {}),
      (req) => {
        req.onText('');
        return text('Temos Roupas.');
      },
    ]);
    const res = await request(createApp({ llm }))
      .post('/chat')
      .set({ ...bearer(tenantA.token), Accept: 'text/event-stream' })
      .send({ message: 'categorias?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: tool\ndata: {"name":"list_categories"}');
    expect(res.text).toContain('event: text\ndata: {"text":"Temos Roupas."}');
    expect(res.text.trim().endsWith('event: done\ndata: {}')).toBe(true);
  });

  it('reports upstream failures as an SSE error event', async () => {
    const llm: LlmClient = {
      async streamTurn() {
        throw new Error('boom');
      },
    };
    const res = await request(createApp({ llm }))
      .post('/chat')
      .set({ ...bearer(tenantA.token), Accept: 'text/event-stream' })
      .send({ message: 'oi' });
    expect(res.text).toContain('event: error');
    expect(res.text).not.toContain('boom');
  });
});
