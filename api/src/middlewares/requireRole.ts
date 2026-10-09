import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { Role } from '../modules/auth/user.model.js';

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw unauthorized();
    if (!roles.includes(req.auth.role)) throw forbidden('Apenas administradores podem fazer isso');
    next();
  };
