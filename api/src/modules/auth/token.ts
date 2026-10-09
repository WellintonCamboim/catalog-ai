import jwt, { type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { unauthorized } from '../../lib/errors.js';
import { ROLES, type Role } from './user.model.js';

export interface AuthContext {
  userId: string;
  companyId: string;
  role: Role;
}

const payloadSchema = z.object({
  sub: z.string(),
  companyId: z.string(),
  role: z.enum(ROLES),
});

export function signToken(ctx: AuthContext): string {
  return jwt.sign({ companyId: ctx.companyId, role: ctx.role }, env.JWT_SECRET, {
    subject: ctx.userId,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthContext {
  try {
    // Algoritmo fixado: evita ataques de downgrade (ex.: alg "none").
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const payload = payloadSchema.parse(decoded);
    return { userId: payload.sub, companyId: payload.companyId, role: payload.role };
  } catch {
    throw unauthorized('Token inválido ou expirado');
  }
}
