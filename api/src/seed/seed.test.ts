import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../test/db.js';
import { companies, DEMO_PASSWORD } from './data.js';
import { runSeed } from './run.js';

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('seed', () => {
  it('has at least 10 products per company', () => {
    expect(companies).toHaveLength(2);
    for (const c of companies) expect(c.products.length).toBeGreaterThanOrEqual(10);
  });

  it('is idempotent and the seeded users can log in with isolated catalogs', async () => {
    await runSeed();
    await runSeed();

    const app = createApp();
    for (const c of companies) {
      const login = await request(app)
        .post('/auth/login')
        .send({ email: `user@${c.slug}.example`, password: DEMO_PASSWORD });
      expect(login.status).toBe(200);

      const list = await request(app)
        .get('/products?limit=100')
        .set({ Authorization: `Bearer ${login.body.token}` });
      expect(list.body.total).toBe(c.products.length);
    }
  });
});
