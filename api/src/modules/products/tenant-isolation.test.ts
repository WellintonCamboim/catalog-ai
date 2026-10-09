import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/db.js';
import { Product } from './product.model.js';
import { productRepository as repo } from './product.repository.js';

const companyA = new Types.ObjectId().toString();
const companyB = new Types.ObjectId().toString();

const sample = (name: string, price = 10) => ({
  name,
  description: `Descrição de ${name}`,
  price,
  category: 'Geral',
});

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('repository isolation', () => {
  it('lists only the tenant products', async () => {
    await repo.create(companyA, sample('Produto A'));
    await repo.create(companyB, sample('Produto B'));

    const a = await repo.list(companyA);
    expect(a.items.map((p) => p.name)).toEqual(['Produto A']);
    expect(a.total).toBe(1);
  });

  it("cannot read another tenant's product by id", async () => {
    const created = await repo.create(companyA, sample('Segredo'));
    expect(await repo.findById(companyB, String(created._id))).toBeNull();
    expect(await repo.findById(companyA, String(created._id))).not.toBeNull();
  });

  it("cannot update or delete another tenant's product", async () => {
    const created = await repo.create(companyA, sample('Intocável'));
    const id = String(created._id);

    expect(await repo.update(companyB, id, { name: 'Hackeado' })).toBeNull();
    expect(await repo.remove(companyB, id)).toBe(false);

    const still = await repo.findById(companyA, id);
    expect(still?.name).toBe('Intocável');
  });

  it('search and category filters stay inside the tenant', async () => {
    await repo.create(companyA, sample('Camiseta azul'));
    await repo.create(companyB, sample('Camiseta vermelha'));

    const res = await repo.list(companyA, { q: 'camiseta' });
    expect(res.items).toHaveLength(1);
    expect(res.items[0]?.name).toBe('Camiseta azul');
    expect(await repo.listCategories(companyB)).toEqual(['Geral']);
  });

  it('treats user input as literal text, not as a regex', async () => {
    await repo.create(companyA, sample('Produto A'));
    expect((await repo.list(companyA, { q: '.*' })).items).toHaveLength(0);
  });

  it('matches multi-word queries across fields in any order', async () => {
    await repo.create(companyA, { ...sample('Vela Aromática Lavanda'), category: 'Velas' });
    await repo.create(companyA, sample('Vela de Baunilha'));

    const names = async (q: string) => (await repo.list(companyA, { q })).items.map((p) => p.name);
    expect(await names('vela de lavanda')).toEqual(['Vela Aromática Lavanda']);
    expect(await names('lavanda vela')).toEqual(['Vela Aromática Lavanda']);
    expect(await names('velas')).toEqual(['Vela Aromática Lavanda']);
  });

  it('returns null/false for malformed ids instead of throwing', async () => {
    expect(await repo.findById(companyA, 'not-an-id')).toBeNull();
    expect(await repo.update(companyA, 'not-an-id', { name: 'x' })).toBeNull();
    expect(await repo.remove(companyA, 'not-an-id')).toBe(false);
  });
});

describe('tenantScope plugin (safety net)', () => {
  beforeEach(async () => {
    await repo.create(companyA, sample('Produto A'));
    await repo.create(companyB, sample('Produto B'));
  });

  it('rejects queries without company_id', async () => {
    await expect(Product.find({})).rejects.toThrow(/Tenant scope/);
    await expect(Product.findOne({ name: 'Produto B' })).rejects.toThrow(/Tenant scope/);
    await expect(Product.countDocuments()).rejects.toThrow(/Tenant scope/);
    await expect(Product.deleteMany({})).rejects.toThrow(/Tenant scope/);
    await expect(Product.updateMany({}, { price: 0 })).rejects.toThrow(/Tenant scope/);
  });

  it('rejects operator objects that would match other tenants', async () => {
    await expect(Product.find({ company_id: { $ne: companyA } })).rejects.toThrow(/Tenant scope/);
    await expect(Product.find({ company_id: { $exists: true } })).rejects.toThrow(/Tenant scope/);
  });

  it('rejects aggregations that do not start by matching the tenant', async () => {
    await expect(Product.aggregate([{ $group: { _id: '$category' } }])).rejects.toThrow(
      /Tenant scope/,
    );
    const ok = await Product.aggregate([
      { $match: { company_id: new Types.ObjectId(companyA) } },
      { $group: { _id: '$category', n: { $sum: 1 } } },
    ]);
    expect(ok).toEqual([{ _id: 'Geral', n: 1 }]);
  });

  it('does not allow changing company_id through an update', async () => {
    const [a] = (await repo.list(companyA)).items;
    await expect(
      Product.findOneAndUpdate({ _id: a!._id, company_id: companyA }, { company_id: companyB }),
    ).rejects.toThrow(/immutable/);
    await expect(
      Product.updateOne({ _id: a!._id, company_id: companyA }, { $set: { company_id: companyB } }),
    ).rejects.toThrow(/immutable/);
  });
});
