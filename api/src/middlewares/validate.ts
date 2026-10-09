import type { RequestHandler } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

export const validate =
  (schema: z.ZodType, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw badRequest('Dados inválidos', z.flattenError(result.error).fieldErrors);
    }
    // In Express 5 req.query is a getter, so assign through defineProperty.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
