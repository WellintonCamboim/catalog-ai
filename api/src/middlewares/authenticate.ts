import type { RequestHandler } from 'express';
import { unauthorized } from '../lib/errors.js';
import { verifyToken } from '../modules/auth/token.js';

/** Exige `Authorization: Bearer <jwt>` e popula `req.auth` (userId, companyId, role). */
export const authenticate: RequestHandler = (req, _res, next) => {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized();
  req.auth = verifyToken(token);
  next();
};
