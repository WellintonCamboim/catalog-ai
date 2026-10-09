import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/db.js';
import { MAX_IMAGE_BYTES } from '../uploads/upload.middleware.js';

const app = createApp();

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('fake-but-valid-signature'),
]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('jfif')]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([1, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const onDisk = (publicPath: string) => existsSync(path.join(env.UPLOAD_DIR, publicPath.replace(/^\/uploads\//, '')));

interface Tenant {
  admin: string;
  user: string;
  companyId: string;
  productId: string;
}

async function createTenant(slug: string): Promise<Tenant> {
  const admin = await request(app)
    .post('/auth/register')
    .send({ name: `Admin ${slug}`, email: `admin@${slug}.com`, password: 'senha-forte-1', companyName: `Empresa ${slug}` });
  const me = await request(app).get('/auth/me').set(bearer(admin.body.token));
  const user = await request(app)
    .post('/auth/register')
    .send({ name: `User ${slug}`, email: `user@${slug}.com`, password: 'senha-forte-1', inviteCode: me.body.company.inviteCode });
  const created = await request(app)
    .post('/products')
    .set(bearer(admin.body.token))
    .send({ name: `Produto ${slug}`, description: 'Descrição', price: 10, category: 'Geral' });
  return { admin: admin.body.token, user: user.body.token, companyId: me.body.company.id, productId: created.body.id };
}

const upload = (token: string, productId: string, file: Buffer, filename = 'foto.png', type = 'image/png') =>
  request(app).put(`/products/${productId}/image`).set(bearer(token)).attach('image', file, { filename, contentType: type });

let a: Tenant;
let b: Tenant;

beforeAll(startTestDb);
afterAll(async () => {
  await stopTestDb();
  await rm(env.UPLOAD_DIR, { recursive: true, force: true });
});
beforeEach(async () => {
  await clearTestDb();
  a = await createTenant('a');
  b = await createTenant('b');
});

describe('product image upload', () => {
  it.each([
    ['png', PNG],
    ['jpg', JPEG],
    ['webp', WEBP],
  ])('accepts a %s, stores it under the company folder and serves it', async (ext, file) => {
    const res = await upload(a.admin, a.productId, file);
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(new RegExp(`^/uploads/${a.companyId}/[0-9a-f-]{36}\\.${ext}$`));
    expect(onDisk(res.body.imageUrl)).toBe(true);

    const served = await request(app).get(res.body.imageUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/^image\//);
    expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('only admins can upload', async () => {
    expect((await upload(a.user, a.productId, PNG)).status).toBe(403);
    expect((await request(app).put(`/products/${a.productId}/image`).attach('image', PNG, 'x.png')).status).toBe(401);
  });

  it("returns 404 for another company's product and stores nothing", async () => {
    const res = await upload(b.admin, a.productId, PNG);
    expect(res.status).toBe(404);
    const product = await request(app).get(`/products/${a.productId}`).set(bearer(a.admin));
    expect(product.body.imageUrl).toBeNull();
  });

  it('decides the type from the bytes, not from the name or Content-Type', async () => {
    const res = await upload(a.admin, a.productId, Buffer.from('<svg onload="alert(1)"/>'), 'foto.png', 'image/png');
    expect(res.status).toBe(415);
    expect((await upload(a.admin, a.productId, Buffer.from('<svg/>'), 'x.svg', 'image/svg+xml')).status).toBe(415);
  });

  it('rejects files over the size limit', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect((await upload(a.admin, a.productId, big)).status).toBe(413);
  });

  it('requires the file field', async () => {
    const res = await request(app).put(`/products/${a.productId}/image`).set(bearer(a.admin));
    expect(res.status).toBe(400);
  });

  it('replacing the image deletes the previous file', async () => {
    const first = await upload(a.admin, a.productId, PNG);
    const second = await upload(a.admin, a.productId, JPEG, 'b.jpg', 'image/jpeg');
    expect(onDisk(first.body.imageUrl)).toBe(false);
    expect(onDisk(second.body.imageUrl)).toBe(true);
  });

  it('DELETE /image clears it and removes the file; 404 across tenants', async () => {
    const up = await upload(a.admin, a.productId, PNG);
    expect((await request(app).delete(`/products/${a.productId}/image`).set(bearer(b.admin))).status).toBe(404);
    expect(onDisk(up.body.imageUrl)).toBe(true);

    const res = await request(app).delete(`/products/${a.productId}/image`).set(bearer(a.admin));
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toBeNull();
    expect(onDisk(up.body.imageUrl)).toBe(false);
  });

  it('deleting the product deletes its image', async () => {
    const up = await upload(a.admin, a.productId, PNG);
    await request(app).delete(`/products/${a.productId}`).set(bearer(a.admin)).expect(204);
    expect(onDisk(up.body.imageUrl)).toBe(false);
  });

  it('switching to an external URL deletes the uploaded file', async () => {
    const up = await upload(a.admin, a.productId, PNG);
    const res = await request(app)
      .put(`/products/${a.productId}`)
      .set(bearer(a.admin))
      .send({ imageUrl: 'https://example.com/x.png' });
    expect(res.body.imageUrl).toBe('https://example.com/x.png');
    expect(onDisk(up.body.imageUrl)).toBe(false);
  });

  it('does not accept a local /uploads path forged in the product body', async () => {
    const res = await request(app)
      .put(`/products/${b.productId}`)
      .set(bearer(b.admin))
      .send({ imageUrl: `/uploads/${a.companyId}/00000000-0000-0000-0000-000000000000.png` });
    expect(res.status).toBe(400);
  });

  it('does not serve path traversal or listings', async () => {
    expect((await request(app).get('/uploads/')).status).toBe(404);
    expect((await request(app).get('/uploads/..%2f..%2fpackage.json')).status).toBeGreaterThanOrEqual(400);
  });
});
