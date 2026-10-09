import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { errorHandler } from '../../middlewares/errorHandler.js';
import { authenticate } from '../../middlewares/authenticate.js';
import { requireRole } from '../../middlewares/requireRole.js';
import { clearTestDb, startTestDb, stopTestDb } from '../../test/db.js';
import { User } from './user.model.js';
import { Company } from '../companies/company.model.js';

const app = createApp();

const adminBody = {
  name: 'Ana Admin',
  email: 'ana@a.com',
  password: 'senha-forte-1',
  companyName: 'Empresa A',
};

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('POST /auth/register', () => {
  it('cria empresa e admin, retornando token', async () => {
    const res = await request(app).post('/auth/register').send(adminBody);
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('não guarda a senha em texto puro', async () => {
    await request(app).post('/auth/register').send(adminBody);
    const user = await User.findOne({ email: 'ana@a.com' }).select('+passwordHash');
    expect(user!.passwordHash).not.toContain('senha-forte-1');
  });

  it('entra em empresa existente via inviteCode como user', async () => {
    const admin = await request(app).post('/auth/register').send(adminBody);
    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${admin.body.token}`);
    const res = await request(app)
      .post('/auth/register')
      .send({
        name: 'Beto',
        email: 'beto@a.com',
        password: 'senha-forte-1',
        inviteCode: me.body.company.inviteCode,
      });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('user');
    expect(res.body.user.companyId).toBe(admin.body.user.companyId);
  });

  it('rejeita inviteCode inválido, e-mail duplicado e payload ambíguo', async () => {
    const bad = await request(app)
      .post('/auth/register')
      .send({ name: 'X Y', email: 'x@a.com', password: 'senha-forte-1', inviteCode: 'nope' });
    expect(bad.status).toBe(404);

    await request(app).post('/auth/register').send(adminBody);
    const dup = await request(app).post('/auth/register').send(adminBody);
    expect(dup.status).toBe(409);
    expect(await Company.countDocuments()).toBe(1); // não deixou empresa órfã

    const both = await request(app)
      .post('/auth/register')
      .send({ ...adminBody, email: 'o@a.com', inviteCode: 'abc' });
    expect(both.status).toBe(400);
  });

  it('valida senha curta e e-mail inválido', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...adminBody, email: 'invalido', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('email');
    expect(res.body.error.details).toHaveProperty('password');
  });
});

describe('POST /auth/login e GET /auth/me', () => {
  it('faz login e acessa /me; inviteCode só aparece para admin', async () => {
    await request(app).post('/auth/register').send(adminBody);
    const login = await request(app)
      .post('/auth/login')
      .send({ email: 'ANA@a.com', password: 'senha-forte-1' });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.company.inviteCode).toEqual(expect.any(String));

    const user = await request(app)
      .post('/auth/register')
      .send({
        name: 'Beto',
        email: 'beto@a.com',
        password: 'senha-forte-1',
        inviteCode: me.body.company.inviteCode,
      });
    const meUser = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${user.body.token}`);
    expect(meUser.body.company).not.toHaveProperty('inviteCode');
  });

  it('retorna a mesma mensagem para senha errada e e-mail inexistente', async () => {
    await request(app).post('/auth/register').send(adminBody);
    const wrongPass = await request(app)
      .post('/auth/login')
      .send({ email: 'ana@a.com', password: 'errada' });
    const noUser = await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@a.com', password: 'qualquer' });
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPass.body.error.message).toBe(noUser.body.error.message);
  });
});

describe('authenticate / requireRole', () => {
  const guarded = express();
  guarded.get('/admin-only', authenticate, requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  guarded.use(errorHandler);

  async function tokenFor(role: 'admin' | 'user') {
    const admin = await request(app).post('/auth/register').send(adminBody);
    if (role === 'admin') return admin.body.token as string;
    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${admin.body.token}`);
    const u = await request(app)
      .post('/auth/register')
      .send({
        name: 'Beto',
        email: 'beto@a.com',
        password: 'senha-forte-1',
        inviteCode: me.body.company.inviteCode,
      });
    return u.body.token as string;
  }

  it('401 sem token ou com token inválido', async () => {
    expect((await request(guarded).get('/admin-only')).status).toBe(401);
    const res = await request(guarded).get('/admin-only').set('Authorization', 'Bearer lixo');
    expect(res.status).toBe(401);
  });

  it('rejeita token assinado com alg "none"', async () => {
    const forged = jwt.sign({ companyId: 'x', role: 'admin' }, '', {
      algorithm: 'none',
      subject: 'u',
    });
    const res = await request(guarded).get('/admin-only').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  it('403 para user e 200 para admin', async () => {
    const userToken = await tokenFor('user');
    expect(
      (await request(guarded).get('/admin-only').set('Authorization', `Bearer ${userToken}`))
        .status,
    ).toBe(403);
    await clearTestDb();
    const adminToken = await tokenFor('admin');
    expect(
      (await request(guarded).get('/admin-only').set('Authorization', `Bearer ${adminToken}`))
        .status,
    ).toBe(200);
  });
});
