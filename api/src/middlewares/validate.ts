import type { RequestHandler } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/** Valida req[source] com zod e substitui pelo valor já parseado (tipado e saneado). */
export const validate =
  (schema: z.ZodType, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw badRequest('Dados inválidos', z.flattenError(result.error).fieldErrors);
    }
    // Em Express 5 req.query é getter; defineProperty permite sobrescrever.
    Object.defineProperty(req, source, { value: result.data, writable: true, configurable: true });
    next();
  };
