import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/db.js';

const app = createApp();

const product = {
  name: 'Camiseta Básica',
  description: 'Camiseta de algodão',
  price: 59.9,
  category: 'Roupas',
  imageUrl: 'https://example.com/camiseta.png',
};

interface Tenant {
  admin: string;
  user: string;
}

async function createTenant(slug: string): Promise<Tenant> {
  const admin = await request(app)
    .post('/auth/register')
    .send({
      name: `Admin ${slug}`,
      email: `admin@${slug}.com`,
      password: 'senha-forte-1',
      companyName: `Empresa ${slug}`,
    });
  const me = await request(app).get('/auth/me').set(bearer(admin.body.token));
  const user = await request(app)
    .post('/auth/register')
    .send({
      name: `User ${slug}`,
      email: `user@${slug}.com`,
      password: 'senha-forte-1',
      inviteCode: me.body.company.inviteCode,
    });
  return { admin: admin.body.token, user: user.body.token };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

let a: Tenant;
let b: Tenant;

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(async () => {
  await clearTestDb();
  a = await createTenant('a');
  b = await createTenant('b');
});

describe('permissions', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/products')).status).toBe(401);
    expect((await request(app).post('/products').send(product)).status).toBe(401);
  });

  it('admin creates, updates and deletes', async () => {
    const created = await request(app).post('/products').set(bearer(a.admin)).send(product);
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty('company_id');
    const id = created.body.id;

    const updated = await request(app)
      .put(`/products/${id}`)
      .set(bearer(a.admin))
      .send({ price: 49.9 });
    expect(updated.status).toBe(200);
    expect(updated.body.price).toBe(49.9);
    expect(updated.body.name).toBe(product.name);

    expect((await request(app).delete(`/products/${id}`).set(bearer(a.admin))).status).toBe(204);
    expect((await request(app).get(`/products/${id}`).set(bearer(a.admin))).status).toBe(404);
  });

  it('user can read but not write', async () => {
    const created = await request(app).post('/products').set(bearer(a.admin)).send(product);
    const id = created.body.id;

    expect((await request(app).get('/products').set(bearer(a.user))).body.total).toBe(1);
    expect((await request(app).get(`/products/${id}`).set(bearer(a.user))).status).toBe(200);

    expect((await request(app).post('/products').set(bearer(a.user)).send(product)).status).toBe(
      403,
    );
    expect(
      (await request(app).put(`/products/${id}`).set(bearer(a.user)).send({ price: 1 })).status,
    ).toBe(403);
    expect((await request(app).delete(`/products/${id}`).set(bearer(a.user))).status).toBe(403);
  });
});

describe('tenant isolation over HTTP', () => {
  it('company B never sees, edits or deletes company A products', async () => {
    const created = await request(app).post('/products').set(bearer(a.admin)).send(product);
    const id = created.body.id;

    const list = await request(app).get('/products').set(bearer(b.admin));
    expect(list.body.items).toEqual([]);
    expect((await request(app).get(`/products/${id}`).set(bearer(b.admin))).status).toBe(404);
    expect(
      (await request(app).put(`/products/${id}`).set(bearer(b.admin)).send({ name: 'x' })).status,
    ).toBe(404);
    expect((await request(app).delete(`/products/${id}`).set(bearer(b.admin))).status).toBe(404);
    expect((await request(app).get(`/products/${id}`).set(bearer(a.admin))).body.name).toBe(
      product.name,
    );
  });

  it('ignores any attempt to choose the tenant from the client', async () => {
    const meB = await request(app).get('/auth/me').set(bearer(b.admin));
    const res = await request(app)
      .post('/products')
      .set(bearer(a.admin))
      .send({ ...product, company_id: meB.body.company.id });
    expect(res.status).toBe(400);

    const viaQuery = await request(app)
      .get(`/products?company_id=${meB.body.company.id}`)
      .set(bearer(a.admin));
    expect(viaQuery.status).toBe(200);
    expect(viaQuery.body.total).toBe(0);
  });

  it('categories are scoped per tenant', async () => {
    await request(app).post('/products').set(bearer(a.admin)).send(product);
    await request(app)
      .post('/products')
      .set(bearer(b.admin))
      .send({ ...product, category: 'Eletrônicos' });
    const res = await request(app).get('/products/categories').set(bearer(a.user));
    expect(res.body.items).toEqual(['Roupas']);
  });
});

describe('validation, filters and pagination', () => {
  it('rejects invalid payloads', async () => {
    const res = await request(app).post('/products').set(bearer(a.admin)).send({
      name: '',
      price: -1,
      category: 'X',
      description: 'd',
      imageUrl: 'javascript:alert(1)',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('name');
    expect(res.body.error.details).toHaveProperty('price');
    expect(res.body.error.details).toHaveProperty('imageUrl');

    const empty = await request(app).put('/products/abc').set(bearer(a.admin)).send({});
    expect(empty.status).toBe(400);
  });

  it('returns 404 for malformed ids', async () => {
    expect((await request(app).get('/products/not-an-id').set(bearer(a.admin))).status).toBe(404);
  });

  it('filters by text, category and price, and paginates', async () => {
    const seed = [
      { ...product, name: 'Camiseta', price: 50 },
      { ...product, name: 'Calça', price: 150 },
      { ...product, name: 'Fone', price: 90, category: 'Eletrônicos', description: 'Bluetooth' },
    ];
    for (const p of seed) await request(app).post('/products').set(bearer(a.admin)).send(p);

    const get = (qs: string) => request(app).get(`/products?${qs}`).set(bearer(a.user));

    expect((await get('q=bluetooth')).body.items.map((p: { name: string }) => p.name)).toEqual([
      'Fone',
    ]);
    expect((await get('category=roupas')).body.total).toBe(2);
    expect((await get('minPrice=60&maxPrice=100')).body.total).toBe(1);
    expect((await get('minPrice=100&maxPrice=10')).status).toBe(400);

    const page = await get('limit=2&page=2');
    expect(page.body.items).toHaveLength(1);
    expect(page.body.totalPages).toBe(2);
  });
});
